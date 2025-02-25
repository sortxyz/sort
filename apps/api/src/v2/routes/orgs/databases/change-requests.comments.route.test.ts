import { randomUUID } from 'node:crypto'

import { getDb } from '@sort/shared'
import {
  dateFormat,
  uuidFormat
} from '@sort/shared/constants/type-mask.constant'
import { ChangeRequestCommentMock } from '@sort/shared/mocks/change-requests/change-request-comment.mock'
import { ChangeRequestMock } from '@sort/shared/mocks/change-requests/change-request.mock'
import { ChangeMock } from '@sort/shared/mocks/change-requests/change.mock'
import { ChangeRequestTestTableMock } from '@sort/shared/mocks/change-requests/test-table.mock'
import { ConnectionMock } from '@sort/shared/mocks/connection.mock'
import { LabelMock } from '@sort/shared/mocks/label.mock'
import {
  MetadataDatabaseMock,
  MetadataTableMock
} from '@sort/shared/mocks/metadata.mock'
import { OrganizationMock } from '@sort/shared/mocks/org.mock'
import { ReviewMock } from '@sort/shared/mocks/review.mock'
import { UserMock } from '@sort/shared/mocks/user.mock'
import * as ChangeRequestService from '@sort/shared/services/change-requests/change-request.service'
import * as ChangeService from '@sort/shared/services/changes/change.service'
import * as ConnectionService from '@sort/shared/services/connection.service'
import * as MetadataDatabaseService from '@sort/shared/services/kysely/metadata/database.service'
import * as MetadataTableService from '@sort/shared/services/kysely/metadata/table.service'
import * as SnapshotService from '@sort/shared/services/kysely/snapshot/snapshot.service'
import * as LabelService from '@sort/shared/services/label.service'
import * as NotificationService from '@sort/shared/services/notification.service'
import * as OrganizationService from '@sort/shared/services/org.service'
import * as UserService from '@sort/shared/services/user.service'

import {
  createKysely,
  disconnectKysely
} from '../../../../global/services/kysely.service'
import { getTestServer } from '../../../../global/utils/test.util'
import { SnapshotMock } from '../../../mocks/snapshot/snapshot.mock'
import { createSortJwt } from '../../../utils/jwt.util'
import {
  testInvalidSortAuthHeaders,
  ParamsTester,
  expectNotFound
} from '../../../utils/test.util'

import type * as ConnectionType from '@sort/shared/types/kysely/connection/connection.type'
import type { SortDB } from '@sort/shared/types/kysely.type'
import type { User } from '@sort/shared/types/user.type'

type MetadataDatabase = SortDB['metadata_database']

describe('/v2 change-requests routes (comments)', () => {
  const userMock = new UserMock()
  const orgMock = new OrganizationMock()
  const dbMock = new MetadataDatabaseMock()
  const labelMock = new LabelMock()
  const connMock = new ConnectionMock()
  const changeRequestMock = new ChangeRequestMock()
  const changeRequestCommentMock = new ChangeRequestCommentMock()
  const reviewMock = new ReviewMock()
  const tableMock = new MetadataTableMock()
  const changeMock = new ChangeMock()
  const snapshotMock = new SnapshotMock()
  const testTableMock = new ChangeRequestTestTableMock()

  const nonOrgUser1 = userMock.create()
  const nonOrgUser2 = userMock.create()
  const orgAdminUser = userMock.create()
  const orgMemberUser1 = userMock.create()
  const orgMemberUser2 = userMock.create()
  const org = orgMock.create({ created_by: orgAdminUser.id })
  const prvConn = connMock.create({
    organization_id: org.id,
    created_by: orgAdminUser.id
  })
  const pubConn = connMock.create({
    organization_id: org.id,
    visibility: 'public',
    created_by: orgAdminUser.id
  })

  const createMockSnapshot = ({
    connectionId,
    creator
  }: {
    connectionId: string
    creator: string
  }) => {
    const snapshot = snapshotMock.create({
      connection_id: connectionId,
      status: 'COMPLETED',
      creator
    })
    const db = snapshotMock.DatabaseMock.create({
      snapshot_id: snapshot.id,
      name: 'sort_xyz'
    })
    const schema1 = snapshotMock.SchemaMock.create({
      database_id: db.id,
      name: 'public'
    })
    const table1 = snapshotMock.TableMock.create({
      schema_id: schema1.id,
      name: 'users'
    })
    const column1 = snapshotMock.ColumnMock.create({
      table_id: table1.id,
      name: 'id',
      type: 'uuid',
      is_primary_key: true,
      nullable: false,
      position: 0
    })
    const column2 = snapshotMock.ColumnMock.create({
      table_id: table1.id,
      name: 'name',
      type: 'text',
      nullable: true,
      position: 1
    })
    const schema2 = snapshotMock.SchemaMock.create({
      database_id: db.id,
      name: 'test'
    })
    const table2 = snapshotMock.TableMock.create({
      schema_id: schema2.id,
      name: 'change_request_test'
    })
    const column3 = snapshotMock.ColumnMock.create({
      table_id: table2.id,
      name: 'id',
      type: 'uuid',
      is_primary_key: true,
      nullable: false,
      position: 0
    })

    return {
      snapshot,
      db,
      schema1,
      table1,
      column1,
      column2,
      schema2,
      table2,
      column3
    }
  }

  const publicSnapshotMock = createMockSnapshot({
    connectionId: pubConn.id,
    creator: orgAdminUser.id
  })

  const prvSnapshotMock = createMockSnapshot({
    connectionId: prvConn.id,
    creator: orgAdminUser.id
  })

  const prvDbEntry = dbMock.create({
    organization_id: org.id,
    connection_id: prvConn.id,
    raw_name: 'sort_xyz'
  })
  const pubDbEntry = dbMock.create({
    organization_id: org.id,
    connection_id: pubConn.id,
    raw_name: 'sort_xyz'
  })
  const label1 = labelMock.create({
    connection_id: prvConn.id,
    database_name: prvDbEntry.raw_name
  })
  const label2 = labelMock.create({
    connection_id: prvConn.id,
    database_name: prvDbEntry.raw_name
  })

  const testTableRow1 = testTableMock.create()

  let server: Awaited<ReturnType<typeof getTestServer>>

  const insertSnapshot = async (
    snap: ReturnType<typeof createMockSnapshot>
  ) => {
    await SnapshotService.insertSnapshot(getDb(), snap.snapshot)
    await snapshotMock.DatabaseMock.insert(snap.db)

    await snapshotMock.SchemaMock.insert(snap.schema1)
    await snapshotMock.TableMock.insert({
      connectionId: snap.snapshot.connection_id,
      databaseName: snap.db.name,
      schemaName: snap.schema1.name,
      table: snap.table1
    })
    await snapshotMock.ColumnMock.insert(snap.column1)
    await snapshotMock.ColumnMock.insert(snap.column2)

    await snapshotMock.SchemaMock.insert(snap.schema2)
    await snapshotMock.TableMock.insert({
      connectionId: snap.snapshot.connection_id,
      databaseName: snap.db.name,
      schemaName: snap.schema2.name,
      table: snap.table2
    })
    await snapshotMock.ColumnMock.insert(snap.column3)
  }

  async function setupTests() {
    await UserService.createUser(orgAdminUser)
    await UserService.createUser(nonOrgUser1)
    await UserService.createUser(nonOrgUser2)
    await UserService.createUser(orgMemberUser1)
    await UserService.createUser(orgMemberUser2)
    await OrganizationService.create(org)
    await OrganizationService.addMember(org.slug, orgMemberUser1.id, 'member')
    await OrganizationService.addMember(org.slug, orgMemberUser2.id, 'member')
    await ConnectionService.create(prvConn)
    await ConnectionService.create(pubConn)

    await insertSnapshot(publicSnapshotMock)
    await insertSnapshot(prvSnapshotMock)

    await MetadataDatabaseService.insertMetadataDb(getDb(), prvDbEntry)
    await MetadataDatabaseService.insertMetadataDb(getDb(), pubDbEntry)
    await LabelService.createDatabaseLabel(label1)
    await LabelService.createDatabaseLabel(label2)

    await testTableMock.insert(testTableRow1)
  }

  async function cleanupTests() {
    await changeRequestCommentMock.removeAll()
    await snapshotMock.removeAll()
    await changeMock.removeAll()
    await tableMock.removeAll()
    await reviewMock.removeAll()
    await changeRequestMock.removeAll()
    await labelMock.removeAll()
    await connMock.removeAll()
    await dbMock.removeAll()
    await orgMock.removeAll(true)
    await userMock.removeAll()
    await testTableMock.removeAll()
  }

  beforeAll(async () => {
    server = await getTestServer()
    createKysely()
    await setupTests()
  })

  beforeEach(async () => {
    const mockChangeRequest = changeRequestMock.create({
      created_by: orgAdminUser.id,
      connection_id: prvConn.id,
      database_name: prvDbEntry.raw_name
    })

    await ChangeRequestService.createChangeRequest(mockChangeRequest)
  })

  afterEach(async () => {
    await changeRequestCommentMock.removeAll()
    await changeMock.removeAll()
    await tableMock.removeAll()
    await reviewMock.removeAll()
    await changeRequestMock.removeAll()
  })

  afterAll(async () => {
    await cleanupTests()
    await disconnectKysely()
  })

  const paramsTester = new ParamsTester({
    org_slug: {
      expectedNotFoundEntity: 'organization',
      expectedValidationError: 'must not have more than 99 characters',
      invalidValue: 'x'.repeat(100),
      validValue: org.slug,
      notFoundValue: 'non-existent'
    },
    db_slug: {
      expectedNotFoundEntity: 'database',
      expectedValidationError: 'must not have more than 99 characters',
      invalidValue: 'x'.repeat(100),
      get validValue() {
        return prvDbEntry.slug
      },
      notFoundValue: 'non-existent'
    },
    change_request_number: {
      expectedNotFoundEntity: 'change request',
      expectedValidationError: 'must be a valid number',
      invalidValue: 'invalid-change-request-number',
      validValue: '1',
      notFoundValue: '10'
    },
    comment_id: {
      expectedNotFoundEntity: 'change request comment',
      expectedValidationError: 'must be a valid GUID (UUID v4)',
      invalidValue: 'invalid-comment-id',
      validValue: randomUUID(),
      notFoundValue: randomUUID()
    }
  })

  const testCreateChangeRequestComment = async (
    caller: User,
    connection: ConnectionType.ConnectionSelectWithEncryption,
    database: MetadataDatabase,
    statusCode: number
  ) => {
    const emailMock = jest.spyOn(
      NotificationService,
      'sendChangeRequestNotification'
    )

    const mockChangeRequest = changeRequestMock.create({
      created_by: orgAdminUser.id,
      connection_id: connection.id,
      database_name: database.raw_name
    })

    const createdChangeRequest =
      await ChangeRequestService.createChangeRequest(mockChangeRequest)

    const commentPayload = changeRequestCommentMock.createPayload()

    const response = await server.inject({
      headers: {
        authorization: `Bearer ${createSortJwt(caller.id)}`
      },
      method: 'POST',
      url: `/v2/orgs/${org.slug}/databases/${database.slug}/change-requests/${createdChangeRequest.change_request_number}/comments`,
      payload: commentPayload
    })

    if (statusCode === 201) {
      expect(response.json()).toEqual({
        type: 'create_change_request_comment',
        payload: {
          change_request_comment: {
            id: expect.any(String),
            change_request_id: createdChangeRequest.id,
            change_id: null,
            review_id: null,
            created_by: caller.id,
            content: commentPayload.content,
            created_at: expect.stringMatching(dateFormat),
            updated_at: expect.stringMatching(dateFormat)
          }
        }
      })
      expect(emailMock).toHaveBeenCalled()
      changeRequestCommentMock.addPayloadId(
        response.json().payload.change_request_comment.id
      )
    } else if (statusCode === 404) {
      expectNotFound(response, 'database')
      expect(emailMock).not.toHaveBeenCalled()
    }

    expect(response.statusCode).toBe(statusCode)
  }

  const testUpdateChangeRequestComment = async (
    author: User,
    caller: User,
    connection: ConnectionType.ConnectionSelectWithEncryption,
    database: MetadataDatabase,
    statusCode: number
  ) => {
    const mockChangeRequest = changeRequestMock.create({
      created_by: orgAdminUser.id,
      connection_id: connection.id,
      database_name: database.raw_name
    })

    const createdChangeRequest =
      await ChangeRequestService.createChangeRequest(mockChangeRequest)

    const mockComment = changeRequestCommentMock.create({
      change_request_id: mockChangeRequest.id,
      created_by: author.id
    })

    const createdComment =
      await ChangeRequestService.createChangeRequestComment(
        {
          org_slug: org.slug,
          change_request_id: mockComment.change_request_id
        },
        {
          id: mockComment.id,
          created_by: mockComment.created_by,
          content: mockComment.content
        }
      )

    const updatePayload = {
      content: 'Updated Comment Content'
    }

    const response = await server.inject({
      headers: {
        authorization: `Bearer ${createSortJwt(caller.id)}`
      },
      method: 'PATCH',
      url: `/v2/orgs/${org.slug}/databases/${database.slug}/change-requests/${createdChangeRequest.change_request_number}/comments/${createdComment.id}`,
      payload: updatePayload
    })

    if (statusCode === 200) {
      expect(response.json()).toEqual({
        type: 'update_change_request_comment',
        payload: {
          change_request_comment: {
            id: createdComment.id,
            change_request_id: createdChangeRequest.id,
            change_id: null,
            review_id: null,
            created_by: author.id,
            content: 'Updated Comment Content',
            created_at: expect.stringMatching(dateFormat),
            updated_at: expect.stringMatching(dateFormat)
          }
        }
      })
    } else if (statusCode === 403) {
      expect(response.json()).toEqual({
        type: 'error',
        payload: {
          error: {
            message: 'Forbidden.'
          }
        }
      })
    } else if (statusCode === 404) {
      expectNotFound(response, 'database')
    }

    expect(response.statusCode).toBe(statusCode)
  }

  const testDeleteChangeRequestComment = async (
    author: User,
    caller: User,
    connection: ConnectionType.ConnectionSelectWithEncryption,
    database: MetadataDatabase,
    statusCode: number
  ) => {
    const mockChangeRequest = changeRequestMock.create({
      created_by: orgAdminUser.id,
      connection_id: connection.id,
      database_name: database.raw_name
    })

    const createdChangeRequest =
      await ChangeRequestService.createChangeRequest(mockChangeRequest)

    const mockComment = changeRequestCommentMock.create({
      change_request_id: mockChangeRequest.id,
      created_by: author.id
    })

    const createdComment =
      await ChangeRequestService.createChangeRequestComment(
        {
          org_slug: org.slug,
          change_request_id: mockComment.change_request_id
        },
        {
          id: mockComment.id,
          created_by: mockComment.created_by,
          content: mockComment.content
        }
      )

    const response = await server.inject({
      headers: {
        authorization: `Bearer ${createSortJwt(caller.id)}`
      },
      method: 'DELETE',
      url: `/v2/orgs/${org.slug}/databases/${database.slug}/change-requests/${createdChangeRequest.change_request_number}/comments/${createdComment.id}`
    })

    if (statusCode === 200) {
      expect(response.json()).toEqual({
        type: 'success',
        payload: {
          success: {
            message: `Change Request comment ${mockComment.id} deleted successfully.`
          }
        }
      })
    } else if (statusCode === 403) {
      expect(response.json()).toEqual({
        type: 'error',
        payload: {
          error: {
            message: 'Forbidden.'
          }
        }
      })
    } else if (statusCode === 404) {
      expectNotFound(response, 'database')
    }
  }

  describe('create_change_request_comment operation', () => {
    paramsTester.testInvalidParams({
      method: 'POST',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/comments',
      userId: orgAdminUser.id
    })

    it('should respond with 400 when no values are passed in the payload', async () => {
      const payload = {}

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/123/comments`,
        payload
      })

      expect(response.json()).toEqual({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'A validation error occurred when validating the body.',
            context: 'body',
            errors: {
              body: {
                content: 'is required'
              }
            }
          }
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should respond with 400 when the content is too long', async () => {
      const payload = changeRequestCommentMock.createPayload({
        content: 'x'.repeat(150001)
      })

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/123/comments`,
        payload
      })

      expect(response.json()).toEqual({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'A validation error occurred when validating the body.',
            context: 'body',
            errors: {
              body: {
                content: 'must not have more than 500 characters'
              }
            }
          }
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should respond with 400 when content is an empty string', async () => {
      const payload = {
        content: ''
      }

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/123/comments`,
        payload
      })

      expect(response.json()).toEqual({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'A validation error occurred when validating the body.',
            context: 'body',
            errors: {
              body: {
                content: 'must not have fewer than 1 characters'
              }
            }
          }
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should respond with 400 when content is null', async () => {
      const payload = {
        content: null
      }

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/123/comments`,
        payload
      })

      expect(response.json()).toEqual({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'A validation error occurred when validating the body.',
            context: 'body',
            errors: {
              body: {
                content: 'must not have fewer than 1 characters'
              }
            }
          }
        }
      })

      expect(response.statusCode).toBe(400)
    })

    testInvalidSortAuthHeaders({
      method: 'POST',
      url: '/v2/orgs/some-org-slug/databases/some-db-slug/change-requests/some-change-request-number/comments'
    })

    paramsTester.testNotFound({
      method: 'POST',
      userId: orgAdminUser.id,
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/comments',
      defaultPayload: { content: 'Updated Content' }
    })

    describe('for Top-Level Change Request Comments', () => {
      describe('for Public Connections', () => {
        describe('when the caller is an Org Owner', () => {
          it('should respond with 201 and successfully create an change request comment', async () => {
            await testCreateChangeRequestComment(
              orgAdminUser,
              pubConn,
              pubDbEntry,
              201
            )
          })
        })

        describe('when the caller is an Org Member', () => {
          it('should respond with 201 and successfully create an change request comment', async () => {
            await testCreateChangeRequestComment(
              orgMemberUser1,
              pubConn,
              pubDbEntry,
              201
            )
          })
        })

        describe('when the caller is a Non-Org Member', () => {
          it('should respond with 201 and successfully create an change request comment', async () => {
            await testCreateChangeRequestComment(
              nonOrgUser1,
              pubConn,
              pubDbEntry,
              201
            )
          })
        })
      })

      describe('for Private Connections', () => {
        describe('when the caller is an Org Owner', () => {
          it('should respond with 201 and successfully create an change request comment', async () => {
            await testCreateChangeRequestComment(
              orgAdminUser,
              prvConn,
              prvDbEntry,
              201
            )
          })
        })

        describe('when the caller is an Org Member', () => {
          it('should respond with 201 and successfully create an change request comment', async () => {
            await testCreateChangeRequestComment(
              orgMemberUser1,
              prvConn,
              prvDbEntry,
              201
            )
          })
        })

        describe('when the caller is a Non-Org Member', () => {
          it('should respond with 404', async () => {
            await testCreateChangeRequestComment(
              nonOrgUser1,
              prvConn,
              prvDbEntry,
              404
            )
          })
        })
      })
    })

    describe('for Top-Level Review Comments', () => {
      it('should respond with 404 when the review does not exist', async () => {
        const mockChangeRequest = changeRequestMock.create({
          created_by: orgAdminUser.id,
          connection_id: pubConn.id,
          database_name: pubDbEntry.raw_name
        })

        const createdChangeRequest =
          await ChangeRequestService.createChangeRequest(mockChangeRequest)

        const payload = changeRequestCommentMock.createPayload({
          content: 'Review Comment Content',
          review_id: randomUUID()
        })

        const response = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'POST',
          url: `/v2/orgs/${org.slug}/databases/${pubDbEntry.slug}/change-requests/${createdChangeRequest.change_request_number}/comments`,
          payload
        })

        expect(response.json()).toEqual({
          type: 'error',
          payload: {
            error: { message: 'Review not found.' }
          }
        })

        expect(response.statusCode).toBe(404)
      })

      it('should respond with 404 when the review does not belong to the change request', async () => {
        const mockTargetChangeRequest = changeRequestMock.create({
          created_by: orgAdminUser.id,
          connection_id: pubConn.id,
          database_name: pubDbEntry.raw_name
        })

        const createdTargetChangeRequest =
          await ChangeRequestService.createChangeRequest(
            mockTargetChangeRequest
          )

        const mockNonTargetChangeRequest = changeRequestMock.create({
          created_by: orgAdminUser.id,
          connection_id: pubConn.id,
          database_name: pubDbEntry.raw_name
        })

        const createdNonTargetChangeRequest =
          await ChangeRequestService.createChangeRequest(
            mockNonTargetChangeRequest
          )

        const createdReview = await reviewMock.createMockReview({
          created_by: orgAdminUser.id,
          change_request_id: createdNonTargetChangeRequest.id
        })

        const payload = changeRequestCommentMock.createPayload({
          content: 'Review Comment Content',
          review_id: createdReview.id
        })

        const response = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'POST',
          url: `/v2/orgs/${org.slug}/databases/${pubDbEntry.slug}/change-requests/${createdTargetChangeRequest.change_request_number}/comments`,
          payload
        })

        expect(response.json()).toEqual({
          type: 'error',
          payload: {
            error: { message: 'Review not found.' }
          }
        })

        expect(response.statusCode).toBe(404)
      })

      it('should respond with 201 and successfully create a review comment', async () => {
        const mockChangeRequest = changeRequestMock.create({
          created_by: orgAdminUser.id,
          connection_id: pubConn.id,
          database_name: pubDbEntry.raw_name
        })

        const createdChangeRequest =
          await ChangeRequestService.createChangeRequest(mockChangeRequest)

        const createdReview = await reviewMock.createMockReview({
          created_by: orgAdminUser.id,
          change_request_id: createdChangeRequest.id
        })

        const payload = changeRequestCommentMock.createPayload({
          content: 'Review Comment Content',
          review_id: createdReview.id
        })

        const response = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'POST',
          url: `/v2/orgs/${org.slug}/databases/${pubDbEntry.slug}/change-requests/${createdChangeRequest.change_request_number}/comments`,
          payload
        })

        expect(response.json()).toEqual({
          type: 'create_change_request_comment',
          payload: {
            change_request_comment: {
              id: expect.any(String),
              content: 'Review Comment Content',
              created_at: expect.stringMatching(dateFormat),
              updated_at: expect.stringMatching(dateFormat),
              created_by: orgAdminUser.id,
              change_request_id: createdChangeRequest.id,
              review_id: createdReview.id,
              change_id: null
            }
          }
        })

        expect(response.statusCode).toBe(201)
        changeRequestCommentMock.addPayloadId(
          response.json().payload.change_request_comment.id
        )
      })
    })

    describe('for Change Comments', () => {
      describe('that are not intended to be part of a Review', () => {
        it('should respond with 404 when the change does not exist', async () => {
          const mockChangeRequest = changeRequestMock.create({
            created_by: orgAdminUser.id,
            connection_id: pubConn.id,
            database_name: pubDbEntry.raw_name
          })

          const createdChangeRequest =
            await ChangeRequestService.createChangeRequest(mockChangeRequest)

          const payload = changeRequestCommentMock.createPayload({
            content: 'Change Comment Content',
            change_id: randomUUID()
          })

          const response = await server.inject({
            headers: {
              authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
            },
            method: 'POST',
            url: `/v2/orgs/${org.slug}/databases/${pubDbEntry.slug}/change-requests/${createdChangeRequest.change_request_number}/comments`,
            payload
          })

          expect(response.json()).toEqual({
            type: 'error',
            payload: {
              error: { message: 'Change not found.' }
            }
          })

          expect(response.statusCode).toBe(404)
        })

        it('should respond with 404 when the change does not belong to the change request', async () => {
          const mockTargetChangeRequest = changeRequestMock.create({
            created_by: orgAdminUser.id,
            connection_id: pubConn.id,
            database_name: pubDbEntry.raw_name
          })

          const createdTargetChangeRequest =
            await ChangeRequestService.createChangeRequest(
              mockTargetChangeRequest
            )

          const mockNonTargetChangeRequest = changeRequestMock.create({
            created_by: orgAdminUser.id,
            connection_id: pubConn.id,
            database_name: pubDbEntry.raw_name
          })

          const createdNonTargetChangeRequest =
            await ChangeRequestService.createChangeRequest(
              mockNonTargetChangeRequest
            )

          const mockTable = tableMock.create({
            connection_id: pubConn.id,
            raw_database_name: pubDbEntry.raw_name,
            raw_name: 'test_table',
            raw_schema_name: 'public'
          })

          const createdTable = await MetadataTableService.insertTable(mockTable)

          const mockChange = changeMock.create({
            change_request_id: createdNonTargetChangeRequest.id,
            connection_id: pubConn.id,
            metadata_database_name: pubDbEntry.raw_name,
            metadata_table_name: createdTable.raw_name,
            metadata_schema_name: createdTable.raw_schema_name
          })

          const createdChange = await ChangeService.insertChange(
            getDb(),
            mockChange
          )

          const payload = changeRequestCommentMock.createPayload({
            content: 'Change Comment Content',
            change_id: createdChange.id
          })

          const response = await server.inject({
            headers: {
              authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
            },
            method: 'POST',
            url: `/v2/orgs/${org.slug}/databases/${pubDbEntry.slug}/change-requests/${createdTargetChangeRequest.change_request_number}/comments`,
            payload
          })

          expect(response.json()).toEqual({
            type: 'error',
            payload: {
              error: { message: 'Change not found.' }
            }
          })

          expect(response.statusCode).toBe(404)
        })

        it('should respond with 201 and successfully create a change comment', async () => {
          const mockChangeRequest = changeRequestMock.create({
            created_by: orgAdminUser.id,
            connection_id: pubConn.id,
            database_name: pubDbEntry.raw_name
          })

          const createdChangeRequest =
            await ChangeRequestService.createChangeRequest(mockChangeRequest)

          const mockTable = tableMock.create({
            connection_id: pubConn.id,
            raw_database_name: pubDbEntry.raw_name,
            raw_name: 'test_table',
            raw_schema_name: 'public'
          })

          const createdTable = await MetadataTableService.insertTable(mockTable)

          const mockChange = changeMock.create({
            change_request_id: createdChangeRequest.id,
            connection_id: pubConn.id,
            metadata_database_name: pubDbEntry.raw_name,
            metadata_table_name: createdTable.raw_name,
            metadata_schema_name: createdTable.raw_schema_name
          })

          const createdChange = await ChangeService.insertChange(
            getDb(),
            mockChange
          )

          const payload = changeRequestCommentMock.createPayload({
            content: 'Change Comment Content',
            change_id: createdChange.id
          })

          const response = await server.inject({
            headers: {
              authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
            },
            method: 'POST',
            url: `/v2/orgs/${org.slug}/databases/${pubDbEntry.slug}/change-requests/${createdChangeRequest.change_request_number}/comments`,
            payload
          })

          expect(response.json()).toEqual({
            type: 'create_change_request_comment',
            payload: {
              change_request_comment: {
                id: expect.stringMatching(uuidFormat),
                content: 'Change Comment Content',
                created_at: expect.stringMatching(dateFormat),
                updated_at: expect.stringMatching(dateFormat),
                created_by: orgAdminUser.id,
                change_request_id: createdChangeRequest.id,
                review_id: null,
                change_id: createdChange.id
              }
            }
          })

          expect(response.statusCode).toBe(201)
          changeRequestCommentMock.addPayloadId(
            response.json().payload.change_request_comment.id
          )
        })
      })

      describe('that are intended to be part of a Review', () => {
        it('should respond with 404 when the change does not exist', async () => {
          const mockChangeRequest = changeRequestMock.create({
            created_by: orgAdminUser.id,
            connection_id: pubConn.id,
            database_name: pubDbEntry.raw_name
          })

          const createdChangeRequest =
            await ChangeRequestService.createChangeRequest(mockChangeRequest)

          const payload = changeRequestCommentMock.createPayload({
            content: 'Change Comment Content',
            change_id: randomUUID()
          })

          const response = await server.inject({
            headers: {
              authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
            },
            method: 'POST',
            url: `/v2/orgs/${org.slug}/databases/${pubDbEntry.slug}/change-requests/${createdChangeRequest.change_request_number}/comments`,
            payload
          })

          expect(response.json()).toEqual({
            type: 'error',
            payload: {
              error: { message: 'Change not found.' }
            }
          })

          expect(response.statusCode).toBe(404)
        })

        it('should respond with 404 when the change does not belong to the change request', async () => {
          const mockTargetChangeRequest = changeRequestMock.create({
            created_by: orgAdminUser.id,
            connection_id: pubConn.id,
            database_name: pubDbEntry.raw_name
          })

          const createdTargetChangeRequest =
            await ChangeRequestService.createChangeRequest(
              mockTargetChangeRequest
            )

          const mockNonTargetChangeRequest = changeRequestMock.create({
            created_by: orgAdminUser.id,
            connection_id: pubConn.id,
            database_name: pubDbEntry.raw_name
          })

          const createdNonTargetChangeRequest =
            await ChangeRequestService.createChangeRequest(
              mockNonTargetChangeRequest
            )

          const mockTable = tableMock.create({
            connection_id: pubConn.id,
            raw_database_name: pubDbEntry.raw_name,
            raw_name: 'test_table',
            raw_schema_name: 'public'
          })

          const createdTable = await MetadataTableService.insertTable(mockTable)

          const mockChange = changeMock.create({
            change_request_id: createdNonTargetChangeRequest.id,
            connection_id: pubConn.id,
            metadata_database_name: pubDbEntry.raw_name,
            metadata_table_name: createdTable.raw_name,
            metadata_schema_name: createdTable.raw_schema_name
          })

          const createdChange = await ChangeService.insertChange(
            getDb(),
            mockChange
          )

          const createdReview = await reviewMock.createMockReview({
            created_by: orgAdminUser.id,
            change_request_id: createdTargetChangeRequest.id
          })

          const payload = changeRequestCommentMock.createPayload({
            content: 'Change Comment Content',
            change_id: createdChange.id,
            review_id: createdReview.id
          })

          const response = await server.inject({
            headers: {
              authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
            },
            method: 'POST',
            url: `/v2/orgs/${org.slug}/databases/${pubDbEntry.slug}/change-requests/${createdTargetChangeRequest.change_request_number}/comments`,
            payload
          })

          expect(response.json()).toEqual({
            type: 'error',
            payload: {
              error: { message: 'Change not found.' }
            }
          })

          expect(response.statusCode).toBe(404)
        })

        it('should respond with 404 when the review does not exist', async () => {
          const mockChangeRequest = changeRequestMock.create({
            created_by: orgAdminUser.id,
            connection_id: pubConn.id,
            database_name: pubDbEntry.raw_name
          })

          const createdChangeRequest =
            await ChangeRequestService.createChangeRequest(mockChangeRequest)

          const payload = changeRequestCommentMock.createPayload({
            content: 'Change Comment Content',
            review_id: randomUUID()
          })

          const response = await server.inject({
            headers: {
              authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
            },
            method: 'POST',
            url: `/v2/orgs/${org.slug}/databases/${pubDbEntry.slug}/change-requests/${createdChangeRequest.change_request_number}/comments`,
            payload
          })

          expect(response.json()).toEqual({
            type: 'error',
            payload: {
              error: { message: 'Review not found.' }
            }
          })

          expect(response.statusCode).toBe(404)
        })

        it('should respond with 404 when the review does not belong to the change request', async () => {
          const mockTargetChangeRequest = changeRequestMock.create({
            created_by: orgAdminUser.id,
            connection_id: pubConn.id,
            database_name: pubDbEntry.raw_name
          })

          const createdTargetChangeRequest =
            await ChangeRequestService.createChangeRequest(
              mockTargetChangeRequest
            )

          const mockNonTargetChangeRequest = changeRequestMock.create({
            created_by: orgAdminUser.id,
            connection_id: pubConn.id,
            database_name: pubDbEntry.raw_name
          })

          const createdNonTargetChangeRequest =
            await ChangeRequestService.createChangeRequest(
              mockNonTargetChangeRequest
            )

          const mockTable = tableMock.create({
            connection_id: pubConn.id,
            raw_database_name: pubDbEntry.raw_name,
            raw_name: 'test_table',
            raw_schema_name: 'public'
          })

          const createdTable = await MetadataTableService.insertTable(mockTable)

          const mockChange = changeMock.create({
            change_request_id: createdTargetChangeRequest.id,
            connection_id: pubConn.id,
            metadata_database_name: pubDbEntry.raw_name,
            metadata_table_name: createdTable.raw_name,
            metadata_schema_name: createdTable.raw_schema_name
          })

          const createdChange = await ChangeService.insertChange(
            getDb(),
            mockChange
          )

          const createdReview = await reviewMock.createMockReview({
            created_by: orgAdminUser.id,
            change_request_id: createdNonTargetChangeRequest.id
          })

          const payload = changeRequestCommentMock.createPayload({
            content: 'Change Comment Content',
            change_id: createdChange.id,
            review_id: createdReview.id
          })

          const response = await server.inject({
            headers: {
              authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
            },
            method: 'POST',
            url: `/v2/orgs/${org.slug}/databases/${pubDbEntry.slug}/change-requests/${createdTargetChangeRequest.change_request_number}/comments`,
            payload
          })

          expect(response.json()).toEqual({
            type: 'error',
            payload: {
              error: { message: 'Review not found.' }
            }
          })

          expect(response.statusCode).toBe(404)
        })

        it('should respond with 201 and successfully create a change comment', async () => {
          const mockChangeRequest = changeRequestMock.create({
            created_by: orgAdminUser.id,
            connection_id: pubConn.id,
            database_name: pubDbEntry.raw_name
          })

          const createdChangeRequest =
            await ChangeRequestService.createChangeRequest(mockChangeRequest)

          const mockTable = tableMock.create({
            connection_id: pubConn.id,
            raw_database_name: pubDbEntry.raw_name,
            raw_name: 'test_table',
            raw_schema_name: 'public'
          })

          const createdTable = await MetadataTableService.insertTable(mockTable)

          const mockChange = changeMock.create({
            change_request_id: createdChangeRequest.id,
            connection_id: pubConn.id,
            metadata_database_name: pubDbEntry.raw_name,
            metadata_table_name: createdTable.raw_name,
            metadata_schema_name: createdTable.raw_schema_name
          })

          const createdChange = await ChangeService.insertChange(
            getDb(),
            mockChange
          )

          const createdReview = await reviewMock.createMockReview({
            created_by: orgAdminUser.id,
            change_request_id: createdChangeRequest.id
          })

          const payload = changeRequestCommentMock.createPayload({
            content: 'Change Comment Content',
            change_id: createdChange.id,
            review_id: createdReview.id
          })

          const response = await server.inject({
            headers: {
              authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
            },
            method: 'POST',
            url: `/v2/orgs/${org.slug}/databases/${pubDbEntry.slug}/change-requests/${createdChangeRequest.change_request_number}/comments`,
            payload
          })

          expect(response.json()).toEqual({
            type: 'create_change_request_comment',
            payload: {
              change_request_comment: {
                id: expect.any(String),
                content: 'Change Comment Content',
                created_at: expect.stringMatching(dateFormat),
                updated_at: expect.stringMatching(dateFormat),
                created_by: orgAdminUser.id,
                change_request_id: createdChangeRequest.id,
                review_id: createdReview.id,
                change_id: createdChange.id
              }
            }
          })

          expect(response.statusCode).toBe(201)
          changeRequestCommentMock.addPayloadId(
            response.json().payload.change_request_comment.id
          )
        })
      })
    })
  })

  describe('update_change_request_comment operation', () => {
    paramsTester.testInvalidParams({
      method: 'PATCH',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/comments/:comment_id',
      userId: orgAdminUser.id
    })

    it('should respond with 400 when no values are passed in the payload', async () => {
      const payload = {}

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'PATCH',
        url: `/v2/orgs/some-org-slug/databases/some-db-slug/change-requests/123/comments/${randomUUID()}`,
        payload
      })

      expect(response.json()).toEqual({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'A validation error occurred when validating the body.',
            context: 'body',
            errors: {
              body: {
                content: 'is required'
              }
            }
          }
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should respond with 400 when the content is too long', async () => {
      const payload = changeRequestCommentMock.createPayload({
        content: 'x'.repeat(150001)
      })

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'PATCH',
        url: `/v2/orgs/some-org-slug/databases/some-db-slug/change-requests/123/comments/${randomUUID()}`,
        payload
      })

      expect(response.json()).toEqual({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'A validation error occurred when validating the body.',
            context: 'body',
            errors: {
              body: {
                content: 'must not have more than 500 characters'
              }
            }
          }
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should respond with 400 when content is an empty string', async () => {
      const payload = {
        content: ''
      }

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'PATCH',
        url: `/v2/orgs/some-org-slug/databases/some-db-slug/change-requests/123/comments/${randomUUID()}`,
        payload
      })

      expect(response.json()).toEqual({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'A validation error occurred when validating the body.',
            context: 'body',
            errors: {
              body: {
                content: 'must not have fewer than 1 characters'
              }
            }
          }
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should respond with 400 when content is null', async () => {
      const payload = {
        content: null
      }

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'PATCH',
        url: `/v2/orgs/some-org-slug/databases/some-db-slug/change-requests/123/comments/${randomUUID()}`,
        payload
      })

      expect(response.json()).toEqual({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'A validation error occurred when validating the body.',
            context: 'body',
            errors: {
              body: {
                content: 'must not have fewer than 1 characters'
              }
            }
          }
        }
      })

      expect(response.statusCode).toBe(400)
    })

    testInvalidSortAuthHeaders({
      method: 'PATCH',
      url: '/v2/orgs/some-org-slug/databases/some-db-slug/change-requests/some-change-request-number/comments/some-comment-id'
    })

    paramsTester.testNotFound({
      method: 'PATCH',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/comments/:comment_id',
      defaultPayload: { content: 'Updated Content' },
      userId: orgAdminUser.id
    })

    describe('for Public Connections', () => {
      describe('when the caller is an Org Owner', () => {
        describe('who is the comment Author', () => {
          it('should respond with 200 and successfully update the change request comment', async () => {
            await testUpdateChangeRequestComment(
              orgAdminUser,
              orgAdminUser,
              pubConn,
              pubDbEntry,
              200
            )
          })
        })

        describe('who is not the comment Author', () => {
          it('should respond with 403 and be forbidden to update Org Member comments', async () => {
            await testUpdateChangeRequestComment(
              orgMemberUser1,
              orgAdminUser,
              pubConn,
              pubDbEntry,
              403
            )
          })

          it('should respond with 403 and be forbidden to update Non-Org Member comments', async () => {
            await testUpdateChangeRequestComment(
              nonOrgUser1,
              orgAdminUser,
              pubConn,
              pubDbEntry,
              403
            )
          })
        })
      })

      describe('when the caller is an Org Member', () => {
        describe('who is the comment Author', () => {
          it('should respond with 200 and successfully update the change request comment', async () => {
            await testUpdateChangeRequestComment(
              orgMemberUser1,
              orgMemberUser1,
              pubConn,
              pubDbEntry,
              200
            )
          })
        })

        describe('who is not the comment Author', () => {
          it('should respond with 403 and be forbidden to update Org Owner comments', async () => {
            await testUpdateChangeRequestComment(
              orgAdminUser,
              orgMemberUser1,
              pubConn,
              pubDbEntry,
              403
            )
          })

          it('should respond with 403 and be forbidden to update other Org Member comments', async () => {
            await testUpdateChangeRequestComment(
              orgMemberUser2,
              orgMemberUser1,
              pubConn,
              pubDbEntry,
              403
            )
          })

          it('should respond with 403 and be forbidden to update Non-Org Member comments', async () => {
            await testUpdateChangeRequestComment(
              nonOrgUser1,
              orgMemberUser1,
              pubConn,
              pubDbEntry,
              403
            )
          })
        })
      })

      describe('when the caller is a Non-Org Member', () => {
        describe('who is the comment Author', () => {
          it('should respond with 200 and successfully update the change request comment', async () => {
            await testUpdateChangeRequestComment(
              nonOrgUser1,
              nonOrgUser1,
              pubConn,
              pubDbEntry,
              200
            )
          })
        })

        describe('who is not the comment Author', () => {
          it('should respond with 403 and be forbidden to update Org Owner comments', async () => {
            await testUpdateChangeRequestComment(
              orgAdminUser,
              nonOrgUser1,
              pubConn,
              pubDbEntry,
              403
            )
          })

          it('should respond with 403 and be forbidden to update Org Member comments', async () => {
            await testUpdateChangeRequestComment(
              orgMemberUser1,
              nonOrgUser1,
              pubConn,
              pubDbEntry,
              403
            )
          })

          it('should respond with 403 and be forbidden to update other Non-Org Member comments', async () => {
            await testUpdateChangeRequestComment(
              nonOrgUser2,
              nonOrgUser1,
              pubConn,
              pubDbEntry,
              403
            )
          })
        })
      })
    })

    describe('for Private Connections', () => {
      describe('when the caller is an Org Owner', () => {
        describe('who is the comment Author', () => {
          it('should respond with 200 and successfully update the change request comment', async () => {
            await testUpdateChangeRequestComment(
              orgAdminUser,
              orgAdminUser,
              prvConn,
              prvDbEntry,
              200
            )
          })
        })

        describe('who is not the comment Author', () => {
          it('should respond with 403 and be forbidden to update Org Member comments', async () => {
            await testUpdateChangeRequestComment(
              orgMemberUser1,
              orgAdminUser,
              prvConn,
              prvDbEntry,
              403
            )
          })
        })
      })

      describe('when the caller is an Org Member', () => {
        describe('who is the comment Author', () => {
          it('should respond with 200 and successfully update the change request comment', async () => {
            await testUpdateChangeRequestComment(
              orgMemberUser1,
              orgMemberUser1,
              prvConn,
              prvDbEntry,
              200
            )
          })
        })

        describe('who is not the comment Author', () => {
          it('should respond with 403 and be forbidden to update Org Owner comments', async () => {
            await testUpdateChangeRequestComment(
              orgAdminUser,
              orgMemberUser1,
              prvConn,
              prvDbEntry,
              403
            )
          })

          it('should respond with 403 and be forbidden to update other Org Member comments', async () => {
            await testUpdateChangeRequestComment(
              orgMemberUser2,
              orgMemberUser1,
              prvConn,
              prvDbEntry,
              403
            )
          })
        })
      })

      describe('when the caller is a Non-Org Member', () => {
        describe('who is not the comment Author', () => {
          it('should respond with 404 and be forbidden to update Org Owner comments', async () => {
            await testUpdateChangeRequestComment(
              orgAdminUser,
              nonOrgUser1,
              prvConn,
              prvDbEntry,
              404
            )
          })

          it('should respond with 404 and be forbidden to update Org Member comments', async () => {
            await testUpdateChangeRequestComment(
              orgMemberUser1,
              nonOrgUser1,
              prvConn,
              prvDbEntry,
              404
            )
          })
        })
      })
    })
  })

  describe('delete_change_request_comment operation', () => {
    paramsTester.testInvalidParams({
      method: 'DELETE',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/comments/:comment_id',
      userId: orgAdminUser.id
    })

    testInvalidSortAuthHeaders({
      method: 'DELETE',
      url: '/v2/orgs/some-org-slug/databases/some-db-slug/change-requests/some-change-request-number/comments/some-comment-id'
    })

    paramsTester.testNotFound({
      method: 'DELETE',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/comments/:comment_id',
      userId: orgAdminUser.id
    })

    describe('for Public Connections', () => {
      describe('when the caller is an Org Owner', () => {
        describe('who is the comment Author', () => {
          it('should respond with 200 and successfully delete the change request comment', async () => {
            await testDeleteChangeRequestComment(
              orgAdminUser,
              orgAdminUser,
              pubConn,
              pubDbEntry,
              200
            )
          })
        })

        describe('who is not the comment Author', () => {
          it('should respond with 200 and successfully delete Org Member comments', async () => {
            await testDeleteChangeRequestComment(
              orgMemberUser1,
              orgAdminUser,
              pubConn,
              pubDbEntry,
              200
            )
          })

          it('should respond with 200 and successfully delete Non-Org Member comments', async () => {
            await testDeleteChangeRequestComment(
              nonOrgUser1,
              orgAdminUser,
              pubConn,
              pubDbEntry,
              200
            )
          })
        })
      })

      describe('when the caller is an Org Member', () => {
        describe('who is the comment Author', () => {
          it('should respond with 200 and successfully delete the change request comment', async () => {
            await testDeleteChangeRequestComment(
              orgMemberUser1,
              orgMemberUser1,
              pubConn,
              pubDbEntry,
              200
            )
          })
        })

        describe('who is not the comment Author', () => {
          it('should respond with 403 and be forbidden to delete Org Owner comments', async () => {
            await testDeleteChangeRequestComment(
              orgAdminUser,
              orgMemberUser1,
              pubConn,
              pubDbEntry,
              403
            )
          })

          it('should respond with 403 and be forbidden to delete other Org Member comments', async () => {
            await testDeleteChangeRequestComment(
              orgMemberUser2,
              orgMemberUser1,
              pubConn,
              pubDbEntry,
              403
            )
          })

          it('should respond with 403 and be forbidden to delete Non-Org Member comments', async () => {
            await testDeleteChangeRequestComment(
              nonOrgUser1,
              orgMemberUser1,
              pubConn,
              pubDbEntry,
              403
            )
          })
        })
      })

      describe('when the caller is a Non-Org Member', () => {
        describe('who is the comment Author', () => {
          it('should respond with 200 and successfully delete the change request comment', async () => {
            await testDeleteChangeRequestComment(
              nonOrgUser1,
              nonOrgUser1,
              pubConn,
              pubDbEntry,
              200
            )
          })
        })

        describe('who is not the comment Author', () => {
          it('should respond with 403 and be forbidden to delete Org Owner comments', async () => {
            await testDeleteChangeRequestComment(
              orgAdminUser,
              nonOrgUser1,
              pubConn,
              pubDbEntry,
              403
            )
          })

          it('should respond with 403 and be forbidden to delete Org Member comments', async () => {
            await testDeleteChangeRequestComment(
              orgMemberUser1,
              nonOrgUser1,
              pubConn,
              pubDbEntry,
              403
            )
          })

          it('should respond with 403 and be forbidden to delete other Non-Org Member comments', async () => {
            await testDeleteChangeRequestComment(
              nonOrgUser2,
              nonOrgUser1,
              pubConn,
              pubDbEntry,
              403
            )
          })
        })
      })
    })

    describe('for Private Connections', () => {
      describe('when the caller is an Org Owner', () => {
        describe('who is the comment Author', () => {
          it('should respond with 200 and successfully delete the change request comment', async () => {
            await testDeleteChangeRequestComment(
              orgAdminUser,
              orgAdminUser,
              prvConn,
              prvDbEntry,
              200
            )
          })
        })

        describe('who is not the comment Author', () => {
          it('should respond with 200 and successfully delete Org Member comments', async () => {
            await testDeleteChangeRequestComment(
              orgMemberUser1,
              orgAdminUser,
              prvConn,
              prvDbEntry,
              200
            )
          })

          it('should respond with 200 and successfully delete Non-Org Member comments', async () => {
            await testDeleteChangeRequestComment(
              nonOrgUser1,
              orgAdminUser,
              prvConn,
              prvDbEntry,
              200
            )
          })
        })
      })

      describe('when the caller is an Org Member', () => {
        describe('who is the comment Author', () => {
          it('should respond with 200 and successfully delete the change request comment', async () => {
            await testDeleteChangeRequestComment(
              orgMemberUser1,
              orgMemberUser1,
              prvConn,
              prvDbEntry,
              200
            )
          })
        })

        describe('who is not the comment Author', () => {
          it('should respond with 403 and be forbidden to delete Org Owner comments', async () => {
            await testDeleteChangeRequestComment(
              orgAdminUser,
              orgMemberUser1,
              prvConn,
              prvDbEntry,
              403
            )
          })

          it('should respond with 403 and be forbidden to delete other Org Member comments', async () => {
            await testDeleteChangeRequestComment(
              orgMemberUser2,
              orgMemberUser1,
              prvConn,
              prvDbEntry,
              403
            )
          })
        })
      })

      describe('when the caller is a Non-Org Member', () => {
        describe('who is not the comment Author', () => {
          it('should respond with 404 and prevent the deletion of Org Owner comments', async () => {
            await testDeleteChangeRequestComment(
              orgAdminUser,
              nonOrgUser1,
              prvConn,
              prvDbEntry,
              404
            )
          })

          it('should respond with 404 and prevent the deletion of Org Member comments', async () => {
            await testDeleteChangeRequestComment(
              orgMemberUser1,
              nonOrgUser1,
              prvConn,
              prvDbEntry,
              404
            )
          })
        })
      })
    })
  })
})
