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
import { IssueMock } from '@sort/shared/mocks/issue.mock'
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
import * as IssueService from '@sort/shared/services/issue.service'
import * as MetadataDatabaseService from '@sort/shared/services/kysely/metadata/database.service'
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

import type {
  RequestChange,
  ChangeResponse
} from '@sort/shared/schemas/change.schema'
import type { Label } from '@sort/shared/schemas/label.schema'
import type * as OrganizationMemberSchema from '@sort/shared/schemas/org-member.schema'
import type * as ConnectionType from '@sort/shared/types/kysely/connection/connection.type'
import type { SortDB } from '@sort/shared/types/kysely.type'
import type { User } from '@sort/shared/types/user.type'

type MetadataDatabase = SortDB['metadata_database']

describe('/v2 change-requests routes', () => {
  const userMock = new UserMock()
  const orgMock = new OrganizationMock()
  const dbMock = new MetadataDatabaseMock()
  const labelMock = new LabelMock()
  const connMock = new ConnectionMock()
  const issueMock = new IssueMock()
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
      has_default: true,
      position: 0
    })
    const column4 = snapshotMock.ColumnMock.create({
      table_id: table2.id,
      name: 'test_jsonb',
      type: 'jsonb',
      is_primary_key: false,
      nullable: true,
      position: 1
    })
    const column5 = snapshotMock.ColumnMock.create({
      table_id: table2.id,
      name: 'test_binary',
      type: 'bytea',
      is_primary_key: false,
      nullable: true,
      position: 2
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
      column3,
      column4,
      column5
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
  const label3 = labelMock.create({
    connection_id: pubConn.id,
    database_name: pubDbEntry.raw_name
  })
  const label4 = labelMock.create({
    connection_id: pubConn.id,
    database_name: pubDbEntry.raw_name
  })
  const testTableRow1 = testTableMock.create()

  // TODO: Create an OrganizationMemberMock
  const orgMember1 = {
    user: {
      id: orgMemberUser1.id,
      username: orgMemberUser1.username,
      name: orgMemberUser1.name,
      picture: orgMemberUser1.picture
    },
    role: {
      id: 1,
      name: 'member'
    }
  } satisfies OrganizationMemberSchema.OrganizationMember

  const orgMember2 = {
    user: {
      id: orgMemberUser2.id,
      username: orgMemberUser2.username,
      name: orgMemberUser2.name,
      picture: orgMemberUser2.picture
    },
    role: {
      id: 1,
      name: 'member'
    }
  } satisfies OrganizationMemberSchema.OrganizationMember

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
    await snapshotMock.ColumnMock.insert(snap.column4)
    await snapshotMock.ColumnMock.insert(snap.column5)
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
    await LabelService.createDatabaseLabel(label3)
    await LabelService.createDatabaseLabel(label4)
    await testTableMock.insert(testTableRow1)
  }

  async function cleanupTests() {
    await changeRequestCommentMock.removeAll()
    await issueMock.removeAll()
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

  afterEach(async () => {
    await issueMock.removeAll()
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

  const approveChangeRequest = async ({
    author,
    changeRequestId
  }: {
    author: User
    changeRequestId: string
  }) => {
    return await reviewMock.createMockReview({
      created_by: author.id,
      change_request_id: changeRequestId,
      event_type: 'APPROVE'
    })
  }

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

  const testGetChangeRequests = async (
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

    const response = await server.inject({
      headers: {
        authorization: `Bearer ${createSortJwt(caller.id)}`
      },
      method: 'GET',
      url: `/v2/orgs/${org.slug}/databases/${database.slug}/change-requests`
    })

    if (statusCode === 200) {
      changeRequestMock.addPayloadId(createdChangeRequest.id)

      expect(response.json()).toEqual({
        type: 'list_change_requests',
        payload: {
          change_requests: [
            {
              ...mockChangeRequest,
              id: createdChangeRequest.id,
              description: null,
              change_request_number: 1,
              status: 'open',
              created_at: expect.stringMatching(dateFormat),
              updated_at: expect.stringMatching(dateFormat)
            }
          ]
        }
      })
    } else if (statusCode === 404) {
      expectNotFound(response, 'database')
    }

    expect(response.statusCode).toBe(statusCode)
  }

  const testGetChangeRequest = async (
    createdBy: User,
    caller: User,
    connection: ConnectionType.ConnectionSelectWithEncryption,
    database: MetadataDatabase,
    statusCode: number
  ) => {
    const mockChangeRequest = changeRequestMock.create({
      created_by: createdBy.id,
      connection_id: connection.id,
      database_name: database.raw_name
    })

    const createdChangeRequest =
      await ChangeRequestService.createChangeRequest(mockChangeRequest)

    const response = await server.inject({
      headers: {
        authorization: `Bearer ${createSortJwt(caller.id)}`
      },
      method: 'GET',
      url: `/v2/orgs/${org.slug}/databases/${database.slug}/change-requests/1`
    })

    const orgMemberIds = [orgAdminUser, orgMemberUser1, orgMemberUser2].map(
      user => user.id
    )
    const callerIsOrgMember = orgMemberIds.includes(caller.id)
    const callerIsCreator = caller.id === createdBy.id

    let permValue = true
    if (!callerIsOrgMember && !callerIsCreator) {
      permValue = false
    }

    if (statusCode === 200) {
      changeRequestMock.addPayloadId(createdChangeRequest.id)

      expect(response.json()).toEqual({
        type: 'get_change_request',
        payload: {
          change_request: {
            ...mockChangeRequest,
            id: createdChangeRequest.id,
            created_by: createdBy.id,
            description: null,
            change_request_number: 1,
            status: 'open',
            changes: [],
            related_issues: [],
            created_at: expect.stringMatching(dateFormat),
            updated_at: expect.stringMatching(dateFormat),
            permissions: {
              create_comment: {
                message: 'You do not have permission to create a comment.',
                value: true
              },
              create_review: {
                value: callerIsOrgMember,
                message: 'You do not have permission to create a review.'
              },
              edit_reviewers: {
                message: 'You do not have permission to edit reviewers.',
                value: permValue
              },
              edit_labels: {
                message: 'You do not have permission to edit labels.',
                value: permValue
              },
              edit_relations: {
                message: 'You do not have permission to edit relations.',
                value: permValue
              },
              edit_title_description: {
                message:
                  'You do not have permission to edit the title and description.',
                value: permValue
              },
              open_close_change_request: {
                message:
                  'You do not have permission to open or close this change request.',
                value: permValue
              },
              edit_changes: {
                message: 'You do not have permission to edit changes.',
                value: permValue
              }
            }
          }
        }
      })
    } else if (statusCode === 404) {
      expectNotFound(response, 'database')
    }

    expect(response.statusCode).toBe(statusCode)
  }

  const testCreateChangeRequest = async (
    caller: User,
    connection: ConnectionType.ConnectionSelectWithEncryption,
    database: MetadataDatabase,
    statusCode: number,
    changes?: RequestChange[],
    expectedChanges?: ChangeResponse[]
  ) => {
    const emailMock = jest.spyOn(
      NotificationService,
      'sendChangeRequestNotification'
    )

    const issue = issueMock.create({
      connection_id: connection.id,
      database_name: database.raw_name,
      created_by: caller.id
    })
    const createdIssue = await IssueService.createIssue(issue)

    const payload = changeRequestMock.createPayload({
      changes,
      related_issues: [createdIssue.issue_number]
    })

    const response = await server.inject({
      headers: {
        authorization: `Bearer ${createSortJwt(caller.id)}`
      },
      method: 'POST',
      url: `/v2/orgs/${org.slug}/databases/${database.slug}/change-requests`,
      payload
    })

    if (statusCode === 201) {
      const body = response.json()
      changeRequestMock.addPayloadId(body.payload?.change_request?.id)

      expect(body).toMatchObject({
        type: 'create_change_request',
        payload: {
          change_request: expect.objectContaining({
            id: expect.stringMatching(uuidFormat),
            change_request_number: expect.any(Number),
            connection_id: connection.id,
            database_name: database.raw_name,
            created_by: caller.id,
            created_at: expect.stringMatching(dateFormat),
            updated_at: expect.stringMatching(dateFormat),
            title: payload.title,
            reviewers: [],
            description: null,
            labels: [],
            status: 'open',
            changes: expectedChanges ?? [],
            related_issues: [
              {
                issue_number: createdIssue.issue_number,
                issue_title: createdIssue.title,
                issue_id: createdIssue.id
              }
            ]
          })
        }
      })

      expect(emailMock).toHaveBeenCalled()
    } else if (statusCode === 404) {
      expectNotFound(response, 'database')
      expect(emailMock).not.toHaveBeenCalled()
    }

    expect(response.statusCode).toBe(statusCode)
  }

  const testExecuteChangeRequest = async (
    connection: ConnectionType.ConnectionSelectWithEncryption,
    database: MetadataDatabase,
    statusCode: number,
    createdBy: User,
    caller: User,
    approver?: User
  ) => {
    const mockChangeRequest = changeRequestMock.create({
      created_by: createdBy.id,
      connection_id: connection.id,
      database_name: database.raw_name,
      labels: [label1],
      reviewers: [orgMember1]
    })

    const createdChangeRequest =
      await ChangeRequestService.createChangeRequest(mockChangeRequest)

    if (approver) {
      await approveChangeRequest({
        author: approver,
        changeRequestId: mockChangeRequest.id
      })
    }

    const executeResponse = await server.inject({
      headers: {
        authorization: `Bearer ${createSortJwt(caller.id)}`
      },
      method: 'PATCH',
      url: `/v2/orgs/${org.slug}/databases/${database.slug}/change-requests/${createdChangeRequest.change_request_number}/execute`
    })

    if (statusCode === 200) {
      expect(executeResponse.json()).toEqual({
        type: 'success',
        payload: {
          success: {
            message: `Change request #${createdChangeRequest.change_request_number} execution scheduled.`
          }
        }
      })
    } else if (statusCode === 403) {
      expect(executeResponse.json()).toEqual({
        type: 'error',
        payload: {
          error: {
            message: 'Forbidden.'
          }
        }
      })
    } else if (statusCode === 404) {
      expect(executeResponse.json()).toEqual({
        type: 'error',
        payload: {
          error: {
            message: 'Database not found.'
          }
        }
      })
    } else if (statusCode === 409) {
      expect(executeResponse.json()).toEqual({
        type: 'error',
        payload: {
          error: {
            message: 'Change request must be approved before execution.'
          }
        }
      })
    } else {
      expect(executeResponse.statusCode).toBe(statusCode)
    }
  }

  const testUpdateChangeRequest = async (
    createdBy: User,
    caller: User,
    connection: ConnectionType.ConnectionSelectWithEncryption,
    database: MetadataDatabase,
    statusCode: number,
    baseLabels: Label[],
    updatedLabels: Label[]
  ) => {
    const emailMock = jest.spyOn(
      NotificationService,
      'sendChangeRequestNotification'
    )

    const deleteChange = {
      action: 'DELETE',
      schema_name: 'test',
      table_name: 'change_request_test',
      primary_keys: [{ column_name: 'id', value: testTableRow1.id }]
    } satisfies RequestChange

    const mockChangeRequest = changeRequestMock.create({
      created_by: createdBy.id,
      connection_id: connection.id,
      database_name: database.raw_name,
      labels: baseLabels,
      reviewers: [orgMember1],
      changes: [deleteChange]
    })

    const createdChangeRequest =
      await ChangeRequestService.createChangeRequest(mockChangeRequest)

    const issue = issueMock.create({
      connection_id: connection.id,
      database_name: database.raw_name,
      created_by: createdBy.id
    })
    const createdIssue = await IssueService.createIssue(issue)

    const updatePayload = {
      title: 'Updated Title',
      description: 'Updated Description',
      status: 'closed',
      labels: updatedLabels.map(label => label.id),
      reviewers: [orgMember2.user.id], // Remove orgMember 1 and add orgMember 2
      related_issues: [createdIssue.issue_number]
    }

    const updateResponse = await server.inject({
      headers: {
        authorization: `Bearer ${createSortJwt(caller.id)}`
      },
      method: 'PATCH',
      url: `/v2/orgs/${org.slug}/databases/${database.slug}/change-requests/${createdChangeRequest.change_request_number}`,
      payload: updatePayload
    })

    if (statusCode === 200) {
      const json = updateResponse.json()
      expect(json).toEqual({
        type: 'update_change_request',
        payload: {
          change_request: {
            ...mockChangeRequest,
            id: createdChangeRequest.id,
            title: 'Updated Title',
            description: 'Updated Description',
            status: 'closed',
            labels: updatedLabels,
            reviewers: [orgMember2],
            related_issues: [
              {
                issue_number: createdIssue.issue_number,
                issue_title: createdIssue.title,
                issue_id: createdIssue.id
              }
            ],
            changes: [
              {
                ...deleteChange,
                index: 0,
                change_request_id: createdChangeRequest.id,
                database_name: database.raw_name,
                id: expect.stringMatching(uuidFormat),
                primary_keys: [
                  {
                    ...deleteChange.primary_keys[0],
                    type: 'uuid'
                  }
                ],
                previous_fields: [
                  {
                    column_name: 'id',
                    type: 'uuid',
                    value: testTableRow1.id
                  },
                  {
                    column_name: 'test_jsonb',
                    type: 'json',
                    value: JSON.stringify([4, '8', 15, '16', 23, 'forty-two'])
                  },
                  {
                    column_name: 'test_binary',
                    type: 'binary',
                    value: Buffer.from('hello world').toString('base64')
                  }
                ]
              }
            ],
            change_request_number: 1,
            created_at: expect.stringMatching(dateFormat),
            updated_at: expect.stringMatching(dateFormat)
          }
        }
      })

      // we notify when status changes
      expect(emailMock).toHaveBeenCalled()
    } else if (statusCode === 403) {
      expect(updateResponse.json()).toEqual({
        type: 'error',
        payload: {
          error: {
            message: 'Forbidden.'
          }
        }
      })
      expect(emailMock).not.toHaveBeenCalled()
    } else if (statusCode === 404) {
      expect(updateResponse.json()).toEqual({
        type: 'error',
        payload: {
          error: {
            message: 'Database not found.'
          }
        }
      })
      expect(emailMock).not.toHaveBeenCalled()
    }

    expect(updateResponse.statusCode).toBe(statusCode)
  }

  describe('create_change_request operation', () => {
    paramsTester.testInvalidParams({
      method: 'POST',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests',
      userId: orgAdminUser.id
    })

    testInvalidSortAuthHeaders({
      method: 'POST',
      url: '/v2/orgs/some-org-slug/databases/some-db-slug/change-requests'
    })

    describe('should respond with 400', () => {
      it('when no values are passed in the payload', async () => {
        const payload = {}

        const response = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'POST',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests`,
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
                  title: 'is required'
                }
              }
            }
          }
        })

        expect(response.statusCode).toBe(400)
      })

      it('when the title is too long', async () => {
        const payload = {
          created_by: orgAdminUser.id,
          title: 'x'.repeat(257),
          labels: [],
          reviewers: [],
          related_issues: []
        }

        const response = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'POST',
          payload,
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests`
        })

        expect(response.json()).toEqual({
          type: 'validation_error',
          payload: {
            validation_error: {
              message: 'A validation error occurred when validating the body.',
              context: 'body',
              errors: {
                body: {
                  title: 'must not have more than 256 characters'
                }
              }
            }
          }
        })

        expect(response.statusCode).toBe(400)
      })

      it('when title is an empty string', async () => {
        const payload = {
          title: '',
          labels: [],
          reviewers: [],
          related_issues: []
        }

        const response = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'POST',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests`,
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
                  title: 'must not have fewer than 2 characters'
                }
              }
            }
          }
        })

        expect(response.statusCode).toBe(400)
      })

      it('when title is null', async () => {
        const payload = {
          created_by: orgAdminUser.id,
          title: null,
          labels: [],
          reviewers: [],
          related_issues: []
        }

        const response = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'POST',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests`,
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
                  title: 'must not have fewer than 2 characters'
                }
              }
            }
          }
        })

        expect(response.statusCode).toBe(400)
      })

      it('when the description is too long', async () => {
        const payload = changeRequestMock.createPayload({
          title: 'Test Change Request Title',
          description: 'x'.repeat(150001)
        })

        const response = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'POST',
          payload,
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests`
        })

        expect(response.json()).toEqual({
          type: 'validation_error',
          payload: {
            validation_error: {
              message: 'A validation error occurred when validating the body.',
              context: 'body',
              errors: {
                body: {
                  description: 'must not have more than 150000 characters'
                }
              }
            }
          }
        })

        expect(response.statusCode).toBe(400)
      })

      it('when column is not nullable', async () => {
        const payload = changeRequestMock.createPayload({
          title: 'Minimal Test Change Request',
          changes: [
            {
              action: 'MODIFY',
              fields: [
                {
                  column_name: 'name',
                  value: 'bob'
                },
                {
                  column_name: 'id',
                  value: null
                }
              ],
              primary_keys: [
                {
                  column_name: 'name',
                  value: 'frank'
                }
              ],
              table_name: 'users',
              schema_name: 'public'
            } satisfies RequestChange
          ]
        })

        const response = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'POST',
          payload,
          url: `/v2/orgs/${org.slug}/databases/${pubDbEntry.slug}/change-requests`
        })

        const message = 'Column "id" cannot be null.'
        expect(response.json()).toEqual({
          type: 'validation_error',
          payload: {
            validation_error: {
              message,
              context: 'body',
              errors: {
                body: {
                  'changes/0/fields/1/value': message
                }
              }
            }
          }
        })

        expect(response.statusCode).toBe(400)
      })
    })

    describe('should create an change request', () => {
      it('with all fields and no changes', async () => {
        const issue1 = issueMock.create({
          connection_id: prvConn.id,
          database_name: prvDbEntry.raw_name,
          created_by: orgMemberUser1.id
        })
        await IssueService.createIssue(issue1)

        const payload = changeRequestMock.createPayload({
          title: 'Detailed Test Change Request',
          description: 'This change request has all possible fields defined.',
          labels: [label1.id],
          reviewers: [orgMemberUser1.id]
        })

        const response = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'POST',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests`,
          payload
        })

        changeRequestMock.addPayloadId(
          response.json().payload?.change_request?.id
        )

        expect(response.json()).toEqual({
          type: 'create_change_request',
          payload: {
            change_request: {
              id: expect.any(String),
              connection_id: prvConn.id,
              database_name: prvDbEntry.raw_name,
              title: payload.title,
              description: payload.description,
              status: 'open',
              change_request_number: 2,
              reviewers: [orgMember1],
              labels: [label1],
              changes: [],
              created_by: orgAdminUser.id,
              created_at: expect.stringMatching(dateFormat),
              updated_at: expect.stringMatching(dateFormat),
              related_issues: [issue1.issue_number]
            }
          }
        })

        expect(response.statusCode).toBe(201)
      })

      it('with minimal fields', async () => {
        const payload = changeRequestMock.createPayload({
          title: 'Minimal Test Change Request'
        })

        const response = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'POST',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests`,
          payload
        })

        changeRequestMock.addPayloadId(
          response.json().payload?.change_request?.id
        )

        expect(response.json()).toEqual({
          type: 'create_change_request',
          payload: {
            change_request: {
              id: expect.any(String),
              connection_id: prvConn.id,
              database_name: prvDbEntry.raw_name,
              title: payload.title,
              description: null,
              status: 'open',
              change_request_number: 1,
              reviewers: [],
              labels: [],
              changes: [],
              created_by: orgAdminUser.id,
              created_at: expect.stringMatching(dateFormat),
              updated_at: expect.stringMatching(dateFormat),
              related_issues: []
            }
          }
        })

        expect(response.statusCode).toBe(201)
      })

      it('with jsonb in an ADD change', async () => {
        const payload = changeRequestMock.createPayload({
          title: 'Minimal Test Change Request',
          changes: [
            {
              action: 'ADD',
              schema_name: 'test',
              table_name: 'change_request_test',
              fields: [
                {
                  column_name: 'test_jsonb',
                  value: '[4,3]'
                }
              ]
            } as RequestChange
          ]
        })

        const response = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'POST',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests`,
          payload
        })

        changeRequestMock.addPayloadId(
          response.json().payload?.change_request?.id
        )

        expect(response.json()).toEqual({
          type: 'create_change_request',
          payload: {
            change_request: {
              id: expect.any(String),
              connection_id: prvConn.id,
              database_name: prvDbEntry.raw_name,
              title: payload.title,
              description: null,
              status: 'open',
              change_request_number: 1,
              reviewers: [],
              labels: [],
              changes: [
                {
                  id: expect.stringMatching(uuidFormat),
                  index: 0,
                  action: 'ADD',
                  change_request_id: expect.stringMatching(uuidFormat),
                  database_name: 'sort_xyz',
                  schema_name: 'test',
                  table_name: 'change_request_test',
                  fields: [
                    {
                      column_name: 'test_jsonb',
                      value: '[4,3]',
                      type: 'json'
                    }
                  ]
                }
              ],
              created_by: orgAdminUser.id,
              created_at: expect.stringMatching(dateFormat),
              updated_at: expect.stringMatching(dateFormat),
              related_issues: []
            }
          }
        })

        expect(response.statusCode).toBe(201)
      })

      it('modifying a row containing jsonb', async () => {
        const payload = changeRequestMock.createPayload({
          title: 'Edit row with jsonb test',
          changes: [
            {
              action: 'MODIFY',
              schema_name: 'test',
              table_name: 'change_request_test',
              primary_keys: [{ column_name: 'id', value: testTableRow1.id }],
              fields: [
                {
                  column_name: 'test_jsonb',
                  value: '[4,3,2]'
                }
              ]
            } as RequestChange
          ]
        })

        const response = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'POST',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests`,
          payload
        })

        changeRequestMock.addPayloadId(
          response.json().payload?.change_request?.id
        )

        expect(response.json()).toEqual({
          type: 'create_change_request',
          payload: {
            change_request: {
              id: expect.any(String),
              connection_id: prvConn.id,
              database_name: prvDbEntry.raw_name,
              title: payload.title,
              description: null,
              status: 'open',
              change_request_number: 1,
              reviewers: [],
              labels: [],
              changes: [
                {
                  id: expect.stringMatching(uuidFormat),
                  index: 0,
                  action: 'MODIFY',
                  change_request_id: expect.stringMatching(uuidFormat),
                  database_name: 'sort_xyz',
                  schema_name: 'test',
                  table_name: 'change_request_test',
                  primary_keys: [
                    { column_name: 'id', type: 'uuid', value: testTableRow1.id }
                  ],
                  fields: [
                    {
                      column_name: 'test_jsonb',
                      value: '[4,3,2]',
                      type: 'json'
                    }
                  ],
                  previous_fields: [
                    {
                      column_name: 'id',
                      type: 'uuid',
                      value: testTableRow1.id
                    },
                    {
                      column_name: 'test_jsonb',
                      type: 'json',
                      value: JSON.stringify([4, '8', 15, '16', 23, 'forty-two'])
                    },
                    {
                      column_name: 'test_binary',
                      type: 'binary',
                      value: Buffer.from('hello world').toString('base64')
                    }
                  ]
                }
              ],
              created_by: orgAdminUser.id,
              created_at: expect.stringMatching(dateFormat),
              updated_at: expect.stringMatching(dateFormat),
              related_issues: []
            }
          }
        })

        expect(response.statusCode).toBe(201)
      })

      it('with bytea in an ADD change', async () => {
        const payload = changeRequestMock.createPayload({
          title: 'Minimal Test Change Request',
          changes: [
            {
              action: 'ADD',
              schema_name: 'test',
              table_name: 'change_request_test',
              fields: [
                {
                  column_name: 'test_binary',
                  value: Buffer.from('hello world').toString('base64')
                }
              ]
            } as RequestChange
          ]
        })

        const response = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'POST',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests`,
          payload
        })

        changeRequestMock.addPayloadId(
          response.json().payload?.change_request?.id
        )

        expect(response.json()).toEqual({
          type: 'create_change_request',
          payload: {
            change_request: {
              id: expect.any(String),
              connection_id: prvConn.id,
              database_name: prvDbEntry.raw_name,
              title: payload.title,
              description: null,
              status: 'open',
              change_request_number: 1,
              reviewers: [],
              labels: [],
              changes: [
                {
                  id: expect.stringMatching(uuidFormat),
                  index: 0,
                  action: 'ADD',
                  change_request_id: expect.stringMatching(uuidFormat),
                  database_name: 'sort_xyz',
                  schema_name: 'test',
                  table_name: 'change_request_test',
                  fields: [
                    {
                      column_name: 'test_binary',
                      value: Buffer.from('hello world').toString('base64'),
                      type: 'binary'
                    }
                  ]
                }
              ],
              created_by: orgAdminUser.id,
              created_at: expect.stringMatching(dateFormat),
              updated_at: expect.stringMatching(dateFormat),
              related_issues: []
            }
          }
        })

        expect(response.statusCode).toBe(201)
      })

      it('with null bytea in an ADD change', async () => {
        const payload = changeRequestMock.createPayload({
          title: 'Null bytea Change Request',
          changes: [
            {
              action: 'ADD',
              schema_name: 'test',
              table_name: 'change_request_test',
              fields: [
                {
                  column_name: 'test_binary',
                  value: null
                }
              ]
            } as RequestChange
          ]
        })

        const response = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'POST',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests`,
          payload
        })

        changeRequestMock.addPayloadId(
          response.json().payload?.change_request?.id
        )

        expect(response.json()).toEqual({
          type: 'create_change_request',
          payload: {
            change_request: {
              id: expect.any(String),
              connection_id: prvConn.id,
              database_name: prvDbEntry.raw_name,
              title: payload.title,
              description: null,
              status: 'open',
              change_request_number: 1,
              reviewers: [],
              labels: [],
              changes: [
                {
                  id: expect.stringMatching(uuidFormat),
                  index: 0,
                  action: 'ADD',
                  change_request_id: expect.stringMatching(uuidFormat),
                  database_name: 'sort_xyz',
                  schema_name: 'test',
                  table_name: 'change_request_test',
                  fields: [
                    {
                      column_name: 'test_binary',
                      value: null,
                      type: 'null'
                    }
                  ]
                }
              ],
              created_by: orgAdminUser.id,
              created_at: expect.stringMatching(dateFormat),
              updated_at: expect.stringMatching(dateFormat),
              related_issues: []
            }
          }
        })

        expect(response.statusCode).toBe(201)
      })

      it('modifying a row containing bytea', async () => {
        const payload = changeRequestMock.createPayload({
          title: 'Edit row with bytea test',
          changes: [
            {
              action: 'MODIFY',
              schema_name: 'test',
              table_name: 'change_request_test',
              primary_keys: [{ column_name: 'id', value: testTableRow1.id }],
              fields: [
                {
                  column_name: 'test_binary',
                  value: Buffer.from('world hello').toString('base64')
                }
              ]
            } as RequestChange
          ]
        })

        const response = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'POST',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests`,
          payload
        })

        changeRequestMock.addPayloadId(
          response.json().payload?.change_request?.id
        )

        expect(response.json()).toEqual({
          type: 'create_change_request',
          payload: {
            change_request: {
              id: expect.any(String),
              connection_id: prvConn.id,
              database_name: prvDbEntry.raw_name,
              title: payload.title,
              description: null,
              status: 'open',
              change_request_number: 1,
              reviewers: [],
              labels: [],
              changes: [
                {
                  id: expect.stringMatching(uuidFormat),
                  index: 0,
                  action: 'MODIFY',
                  change_request_id: expect.stringMatching(uuidFormat),
                  database_name: 'sort_xyz',
                  schema_name: 'test',
                  table_name: 'change_request_test',
                  primary_keys: [
                    { column_name: 'id', type: 'uuid', value: testTableRow1.id }
                  ],
                  fields: [
                    {
                      column_name: 'test_binary',
                      value: Buffer.from('world hello').toString('base64'),
                      type: 'binary'
                    }
                  ],
                  previous_fields: [
                    {
                      column_name: 'id',
                      type: 'uuid',
                      value: testTableRow1.id
                    },
                    {
                      column_name: 'test_jsonb',
                      type: 'json',
                      value: JSON.stringify([4, '8', 15, '16', 23, 'forty-two'])
                    },
                    {
                      column_name: 'test_binary',
                      type: 'binary',
                      value: Buffer.from('hello world').toString('base64')
                    }
                  ]
                }
              ],
              created_by: orgAdminUser.id,
              created_at: expect.stringMatching(dateFormat),
              updated_at: expect.stringMatching(dateFormat),
              related_issues: []
            }
          }
        })

        expect(response.statusCode).toBe(201)
      })

      it('when description is null', async () => {
        const payload = changeRequestMock.createPayload({
          title: 'Null Description Change Request',
          description: null
        })

        const response = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'POST',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests`,
          payload
        })

        changeRequestMock.addPayloadId(
          response.json().payload?.change_request?.id
        )

        expect(response.json()).toEqual({
          type: 'create_change_request',
          payload: {
            change_request: {
              id: expect.any(String),
              connection_id: prvConn.id,
              database_name: prvDbEntry.raw_name,
              title: payload.title,
              description: null,
              status: 'open',
              change_request_number: 1,
              reviewers: [],
              labels: [],
              changes: [],
              created_by: orgAdminUser.id,
              created_at: expect.stringMatching(dateFormat),
              updated_at: expect.stringMatching(dateFormat),
              related_issues: []
            }
          }
        })

        expect(response.statusCode).toBe(201)
      })
    })

    it('responds with 409 when field is not nullable', async () => {
      const payload = changeRequestMock.createPayload({
        title: 'Minimal Test Change Request 2',
        changes: [
          {
            action: 'ADD',
            fields: [
              // id missing as a field triggers this error
              {
                column_name: 'name',
                value: 'bob'
              }
            ],
            table_name: 'users',
            schema_name: 'public'
          } satisfies RequestChange
        ]
      })

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        payload,
        url: `/v2/orgs/${org.slug}/databases/${pubDbEntry.slug}/change-requests`
      })

      const message =
        'Field "id" cannot be null because its column is not nullable and not generated.'
      expect(response.json()).toEqual({
        type: 'error',
        payload: {
          error: {
            message
          }
        }
      })

      expect(response.statusCode).toBe(409)
    })

    paramsTester.testNotFound({
      method: 'POST',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests',
      defaultPayload: changeRequestMock.createPayload(),
      userId: orgAdminUser.id
    })

    it('should respond with 422 when one or more labels cannot be found', async () => {
      const payload = changeRequestMock.createPayload({
        title: 'Never becomes an change request :( ',
        labels: [randomUUID()],
        reviewers: [],
        related_issues: []
      })

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        payload,
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests`
      })

      expect(response.json()).toEqual({
        type: 'error',
        payload: {
          error: {
            message: 'One or more labels not found'
          }
        }
      })

      expect(response.statusCode).toBe(422)
    })

    it('should respond with 422 when one or more reviewers cannot be found', async () => {
      const user2 = userMock.create()
      await UserService.createUser(user2)

      const payload = changeRequestMock.createPayload({
        title: 'Never becomes an change request :( ',
        labels: [],
        reviewers: [user2.id]
      })

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        payload,
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests`
      })

      expect(response.json()).toEqual({
        type: 'error',
        payload: {
          error: {
            message: 'One or more reviewers not found'
          }
        }
      })

      expect(response.statusCode).toBe(422)
    })

    it('should respond with 422 when one or more related issues cannot be found', async () => {
      const payload = changeRequestMock.createPayload({
        title: 'Never becomes an change request :( ',
        labels: [],
        reviewers: [],
        related_issues: [1]
      })

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        payload,
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests`
      })

      expect(response.json()).toEqual({
        type: 'error',
        payload: {
          error: {
            message: 'One or more Issues not found.'
          }
        }
      })

      expect(response.statusCode).toBe(422)
    })

    it('should respond with 500 when a service error occurs', async () => {
      jest
        .spyOn(ChangeRequestService, 'createChangeRequest')
        .mockRejectedValueOnce(new Error('fake error'))

      const payload = changeRequestMock.createPayload({
        title: 'Never becomes an Change Request :('
      })

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        payload,
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests`
      })

      expect(response.json()).toEqual({
        type: 'error',
        payload: {
          error: {
            message: expect.stringMatching(/If the problem persists/)
          }
        }
      })

      expect(response.statusCode).toBe(500)
    })

    describe('when a submitted table name does not exist in the customer db', () => {
      it('responds with 409', async () => {
        const payload = changeRequestMock.createPayload({
          title: 'Invalid table name Change Request',
          changes: [
            {
              action: 'ADD',
              fields: [
                {
                  column_name: 'name',
                  value: 'bob'
                },
                {
                  column_name: 'id',
                  value: randomUUID()
                }
              ],
              table_name: 'non_existent_table',
              schema_name: 'public'
            } satisfies RequestChange
          ]
        })

        const response = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'POST',
          payload,
          url: `/v2/orgs/${org.slug}/databases/${pubDbEntry.slug}/change-requests`
        })

        const msg = /Table "non_existent_table" does not exist in the database./
        expect(response.json()).toEqual({
          type: 'error',
          payload: {
            error: {
              message: expect.stringMatching(msg)
            }
          }
        })

        expect(response.statusCode).toBe(409)
      })
    })

    describe('for Public Connections', () => {
      describe('when the caller is an Org Owner', () => {
        it('should respond with 201 and successfully create a change request', async () => {
          await testCreateChangeRequest(orgAdminUser, pubConn, pubDbEntry, 201)
        })

        it('should successfully create a change request with a basic ADD change', async () => {
          const field1 = {
            column_name: 'id',
            value: randomUUID()
          }
          const field2 = {
            column_name: 'name',
            value: 'bob'
          }

          const changes = [
            {
              action: 'ADD',
              schema_name: 'public',
              table_name: 'users',
              fields: [field1, field2]
            } satisfies RequestChange
          ]

          const expectedChanges = [
            {
              id: expect.stringMatching(uuidFormat),
              change_request_id: expect.stringMatching(uuidFormat),
              action: 'ADD',
              database_name: pubDbEntry.raw_name,
              schema_name: 'public',
              table_name: 'users',
              index: 0,
              fields: [
                { ...field1, type: 'uuid' },
                { ...field2, type: 'string' }
              ]
            } satisfies ChangeResponse
          ]

          await testCreateChangeRequest(
            orgAdminUser,
            pubConn,
            pubDbEntry,
            201,
            changes,
            expectedChanges
          )

          const changeRequests =
            await ChangeRequestService.getFullChangeRequestsResponse({
              org_slug: org.slug,
              connection_id: pubConn.id,
              database_name: pubDbEntry.raw_name
            })

          expect(changeRequests).toHaveLength(1)

          const retrievedChanges =
            await ChangeService.getChangesForChangeRequestId(
              changeRequests[0].id
            )

          expect(retrievedChanges).toHaveLength(1)
          expect(retrievedChanges).toMatchObject([
            {
              action: 'ADD',
              change_request_id: expect.any(String),
              connection_id: expect.any(String),
              id: expect.any(String),
              index: 0,
              metadata_database_name: publicSnapshotMock.db.name,
              metadata_schema_name: publicSnapshotMock.schema1.name,
              metadata_table_name: publicSnapshotMock.table1.name
            }
          ])

          const retrievedFields = await ChangeService.getFieldValuesForChange(
            getDb(),
            retrievedChanges[0].id
          )

          expect(retrievedFields).toHaveLength(2)
          expect(retrievedFields).toMatchObject([
            {
              id: expect.any(String),
              change_id: expect.any(String),
              column_name: 'id',
              uuid_value: expect.any(String),
              string_value: null,
              numeric_value: null,
              date_value: null,
              boolean_value: null,
              binary_value: null,
              json_value: null,
              is_value_null: false
            },
            {
              id: expect.any(String),
              change_id: expect.any(String),
              column_name: 'name',
              string_value: 'bob',
              numeric_value: null,
              date_value: null,
              boolean_value: null,
              binary_value: null,
              json_value: null,
              is_value_null: false
            }
          ])
        })
      })

      describe('when the caller is an Org Member', () => {
        it('should respond with 201 and successfully create a change request', async () => {
          await testCreateChangeRequest(
            orgMemberUser1,
            pubConn,
            pubDbEntry,
            201
          )
        })
      })

      describe('when the caller is an Non-Org Member', () => {
        it('should respond with 201 and successfully create a change request', async () => {
          await testCreateChangeRequest(nonOrgUser1, pubConn, pubDbEntry, 201)
        })
      })
    })

    describe('for Private Connections', () => {
      describe('when the caller is an Org Owner', () => {
        it('should respond with 201 and successfully create a change request', async () => {
          await testCreateChangeRequest(orgAdminUser, prvConn, prvDbEntry, 201)
        })
      })

      describe('when the caller is an Org Member', () => {
        it('should respond with 201 and successfully create a change request', async () => {
          await testCreateChangeRequest(
            orgMemberUser1,
            prvConn,
            prvDbEntry,
            201
          )
        })
      })

      describe('when the caller is an Non-Org Member', () => {
        it('should respond with 404 and an error message', async () => {
          await testCreateChangeRequest(nonOrgUser1, prvConn, prvDbEntry, 404)
        })
      })
    })
  })

  describe('list_change_requests operation', () => {
    paramsTester.testInvalidParams({
      method: 'GET',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests',
      userId: orgAdminUser.id
    })

    testInvalidSortAuthHeaders({
      method: 'GET',
      url: '/v2/orgs/some-org-slug/databases/some-db-slug/change-requests'
    })

    paramsTester.testNotFound({
      method: 'GET',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests',
      userId: orgAdminUser.id
    })

    it('should return all change requests for a database', async () => {
      const change = {
        action: 'ADD',
        schema_name: 'public',
        table_name: 'users',
        fields: [
          {
            column_name: 'id',
            value: randomUUID()
          },
          {
            column_name: 'name',
            value: 'bob'
          }
        ]
      } satisfies RequestChange

      const payload = changeRequestMock.createPayload({
        title: 'Detailed Test Change Request',
        description: 'This change request has all possible fields defined.',
        labels: [label1.id, label2.id],
        reviewers: [orgAdminUser.id],
        changes: [change]
      })

      const response1 = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests`,
        payload
      })

      const createdChangeRequest = response1.json().payload.change_request
      changeRequestMock.addPayloadId(createdChangeRequest.id)

      const response2 = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'GET',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests`
      })

      const orgMemberRows =
        await OrganizationService.createGetMembersBaseQueryBuilder(org.slug)
          .innerJoin(
            'change_request_reviewer',
            'change_request_reviewer.user_id',
            'user.id'
          )
          .where('change_request_reviewer.change_request_id', 'in', [
            createdChangeRequest.id
          ])
          .select('change_request_reviewer.change_request_id')
          .execute()

      const orgMembers = orgMemberRows.map(
        OrganizationService.rowToOrganizationMember
      )

      expect(response2.json()).toEqual({
        type: 'list_change_requests',
        payload: {
          change_requests: [
            {
              ...payload,
              created_by: orgAdminUser.id,
              id: createdChangeRequest.id,
              connection_id: prvConn.id,
              database_name: prvDbEntry.raw_name,
              change_request_number: 1,
              status: 'open',
              labels: [label1, label2],
              reviewers: [orgMembers[0]],
              related_issues: [],
              changes: [
                {
                  ...change,
                  id: expect.stringMatching(uuidFormat),
                  index: 0,
                  change_request_id: createdChangeRequest.id,
                  database_name: prvDbEntry.raw_name,
                  fields: [
                    { ...change.fields[0], type: 'uuid' },
                    { ...change.fields[1], type: 'string' }
                  ]
                }
              ],
              created_at: expect.stringMatching(dateFormat),
              updated_at: expect.stringMatching(dateFormat)
            }
          ]
        }
      })

      expect(response2.statusCode).toBe(200)
    })

    describe('for Public Connections', () => {
      describe('when the caller is an Org Owner', () => {
        it('should respond with 200 and return all change requests', async () => {
          await testGetChangeRequests(orgAdminUser, pubConn, pubDbEntry, 200)
        })
      })

      describe('when the caller is an Org Member', () => {
        it('should respond with 200 and return all change requests', async () => {
          await testGetChangeRequests(orgMemberUser1, pubConn, pubDbEntry, 200)
        })
      })

      describe('when the caller is a Non-Org Member', () => {
        it('should respond with 200 and return all change requests', async () => {
          await testGetChangeRequests(nonOrgUser1, pubConn, pubDbEntry, 200)
        })
      })
    })

    describe('for Private Connections', () => {
      describe('when the caller is an Org Owner', () => {
        it('should respond with 200 and return all change requests', async () => {
          await testGetChangeRequests(orgAdminUser, prvConn, prvDbEntry, 200)
        })
      })

      describe('when the caller is an Org Member', () => {
        it('should respond with 200 and return all change requests', async () => {
          await testGetChangeRequests(orgMemberUser1, prvConn, prvDbEntry, 200)
        })
      })

      describe('when the caller is an Non-Org Member', () => {
        it('should respond with 404', async () => {
          await testGetChangeRequests(nonOrgUser1, prvConn, prvDbEntry, 404)
        })
      })
    })
  })

  describe('get_change_request operation', () => {
    paramsTester.testInvalidParams({
      method: 'GET',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number',
      userId: orgAdminUser.id
    })

    testInvalidSortAuthHeaders({
      method: 'GET',
      url: '/v2/orgs/some-org-slug/databases/some-db-slug/change-requests/some-change-request-number'
    })

    paramsTester.testNotFound({
      method: 'GET',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number',
      userId: orgAdminUser.id
    })

    describe('for Public Connections', () => {
      describe('when the caller is an Org Owner', () => {
        it('should respond with 200 and return the change request with full permissions', async () => {
          await testGetChangeRequest(
            orgAdminUser,
            orgAdminUser,
            pubConn,
            pubDbEntry,
            200
          )
        })
      })
      describe('when the caller is an Org Member', () => {
        it('should respond with 200 and return the change request with full permissions', async () => {
          await testGetChangeRequest(
            orgAdminUser,
            orgMemberUser1,
            pubConn,
            pubDbEntry,
            200
          )
        })
      })
      describe('when the caller is an Non-Org Member', () => {
        describe('and is the change request creator', () => {
          it('should respond with 200 and return the change request with full permissions', async () => {
            await testGetChangeRequest(
              nonOrgUser1,
              nonOrgUser1,
              pubConn,
              pubDbEntry,
              200
            )
          })
        })

        describe('and is not the change request creator', () => {
          it('should respond with 200 and return the change request with only comment permissions', async () => {
            await testGetChangeRequest(
              orgAdminUser,
              nonOrgUser1,
              pubConn,
              pubDbEntry,
              200
            )
          })
        })
      })
    })

    describe('for Private Connections', () => {
      describe('when the caller is an Org Owner', () => {
        it('should respond with 200 and return the change request with full permissions', async () => {
          await testGetChangeRequest(
            orgAdminUser,
            orgAdminUser,
            prvConn,
            prvDbEntry,
            200
          )
        })
      })
      describe('when the caller is an Org Member', () => {
        it('should respond with 200 and return the change request with full permissions', async () => {
          await testGetChangeRequest(
            orgAdminUser,
            orgMemberUser1,
            prvConn,
            prvDbEntry,
            200
          )
        })
      })
      describe('when the caller is an Non-Org Member', () => {
        it('should respond with 404', async () => {
          await testGetChangeRequest(
            orgAdminUser,
            nonOrgUser1,
            prvConn,
            prvDbEntry,
            404
          )
        })
      })
    })

    it('should return an change request for a given change_request_number', async () => {
      const payload = changeRequestMock.createPayload({
        title: 'Detailed Test Change Request',
        description: 'This change request has all possible fields defined.',
        labels: [label1.id, label2.id],
        reviewers: [orgAdminUser.id],
        related_issues: []
      })

      const response1 = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests`,
        payload
      })

      const createdChangeRequest = response1.json().payload.change_request
      changeRequestMock.addPayloadId(createdChangeRequest.id)

      const response2 = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'GET',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${createdChangeRequest.change_request_number}`
      })

      const orgMemberRows =
        await OrganizationService.createGetMembersBaseQueryBuilder(org.slug)
          .innerJoin(
            'change_request_reviewer',
            'change_request_reviewer.user_id',
            'user.id'
          )
          .where('change_request_reviewer.change_request_id', 'in', [
            createdChangeRequest.id
          ])
          .select('change_request_reviewer.change_request_id')
          .execute()

      const orgMembers = orgMemberRows.map(
        OrganizationService.rowToOrganizationMember
      )

      expect(response2.json()).toEqual({
        type: 'get_change_request',
        payload: {
          change_request: {
            ...payload,
            created_by: orgAdminUser.id,
            id: createdChangeRequest.id,
            connection_id: prvConn.id,
            database_name: prvDbEntry.raw_name,
            change_request_number: 1,
            status: 'open',
            labels: [label1, label2],
            reviewers: [orgMembers[0]],
            changes: [],
            created_at: expect.stringMatching(dateFormat),
            updated_at: expect.stringMatching(dateFormat),
            permissions: {
              create_comment: {
                value: true,
                message: 'You do not have permission to create a comment.'
              },
              create_review: {
                value: true,
                message: 'You do not have permission to create a review.'
              },
              edit_title_description: {
                value: true,
                message:
                  'You do not have permission to edit the title and description.'
              },
              edit_relations: {
                value: true,
                message: 'You do not have permission to edit relations.'
              },
              edit_labels: {
                value: true,
                message: 'You do not have permission to edit labels.'
              },
              edit_reviewers: {
                value: true,
                message: 'You do not have permission to edit reviewers.'
              },
              open_close_change_request: {
                value: true,
                message:
                  'You do not have permission to open or close this change request.'
              },
              edit_changes: {
                value: true,
                message: 'You do not have permission to edit changes.'
              }
            }
          }
        }
      })

      expect(response2.statusCode).toBe(200)
    })

    it('should return a 404 when change_request_number is > max postgres integer', async () => {
      const invalidInt = '3774390408407582700'

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'GET',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${invalidInt}`
      })

      expect(response.json()).toEqual({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'A validation error occurred when validating the params.',
            context: 'params',
            errors: {
              params: {
                change_request_number:
                  'must be a number less than or equal to 2147483647'
              }
            }
          }
        }
      })
    })
  })

  describe('update_change_request operation', () => {
    paramsTester.testInvalidParams({
      method: 'PATCH',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number',
      userId: orgAdminUser.id
    })

    describe('responds with 400', () => {
      it('when no values are passed in the payload', async () => {
        const mockChangeRequest = changeRequestMock.create({
          created_by: orgAdminUser.id,
          connection_id: pubConn.id,
          database_name: pubDbEntry.raw_name
        })

        const createdChangeRequest =
          await ChangeRequestService.createChangeRequest(mockChangeRequest)

        const payload = {}

        const response = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'PATCH',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${createdChangeRequest.change_request_number}`,
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
                  $root: 'cannot be an empty object'
                }
              }
            }
          }
        })

        expect(response.statusCode).toBe(400)
      })

      it('when the title is too long', async () => {
        const mockChangeRequest = changeRequestMock.create({
          created_by: orgAdminUser.id,
          connection_id: pubConn.id,
          database_name: pubDbEntry.raw_name
        })

        const createdChangeRequest =
          await ChangeRequestService.createChangeRequest(mockChangeRequest)

        const payload = {
          title: 'x'.repeat(257)
        }

        const response = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'PATCH',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${createdChangeRequest.change_request_number}`,
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
                  title: 'must not have more than 256 characters'
                }
              }
            }
          }
        })

        expect(response.statusCode).toBe(400)
      })

      it('when title is an empty string', async () => {
        const mockChangeRequest = changeRequestMock.create({
          created_by: orgAdminUser.id,
          connection_id: pubConn.id,
          database_name: pubDbEntry.raw_name
        })

        const createdChangeRequest =
          await ChangeRequestService.createChangeRequest(mockChangeRequest)

        const payload = {
          title: ''
        }

        const response = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'PATCH',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${createdChangeRequest.change_request_number}`,
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
                  title: 'must not have fewer than 2 characters'
                }
              }
            }
          }
        })

        expect(response.statusCode).toBe(400)
      })

      it('when title is null', async () => {
        const mockChangeRequest = changeRequestMock.create({
          created_by: orgAdminUser.id,
          connection_id: pubConn.id,
          database_name: pubDbEntry.raw_name
        })

        const createdChangeRequest =
          await ChangeRequestService.createChangeRequest(mockChangeRequest)

        const payload = {
          title: null
        }

        const response = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'PATCH',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${createdChangeRequest.change_request_number}`,
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
                  title: 'must not have fewer than 2 characters'
                }
              }
            }
          }
        })

        expect(response.statusCode).toBe(400)
      })

      it('when the description is too long', async () => {
        const mockChangeRequest = changeRequestMock.create({
          created_by: orgAdminUser.id,
          connection_id: pubConn.id,
          database_name: pubDbEntry.raw_name
        })

        const createdChangeRequest =
          await ChangeRequestService.createChangeRequest(mockChangeRequest)

        const payload = changeRequestMock.createPayload({
          description: 'x'.repeat(150001)
        })

        const response = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'PATCH',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${createdChangeRequest.change_request_number}`,
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
                  description: 'must not have more than 150000 characters'
                }
              }
            }
          }
        })

        expect(response.statusCode).toBe(400)
      })

      it('when the status is neither open nor closed', async () => {
        const mockChangeRequest = changeRequestMock.create({
          created_by: orgAdminUser.id,
          connection_id: pubConn.id,
          database_name: pubDbEntry.raw_name
        })

        const createdChangeRequest =
          await ChangeRequestService.createChangeRequest(mockChangeRequest)

        const payload = {
          status: 'approved'
        }

        const response = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'PATCH',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${createdChangeRequest.change_request_number}`,
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
                  status: 'must match a schema in anyOf'
                }
              }
            }
          }
        })

        expect(response.statusCode).toBe(400)
      })

      it('when the status is null', async () => {
        const mockChangeRequest = changeRequestMock.create({
          created_by: orgAdminUser.id,
          connection_id: pubConn.id,
          database_name: pubDbEntry.raw_name
        })

        const createdChangeRequest =
          await ChangeRequestService.createChangeRequest(mockChangeRequest)

        const payload = {
          status: null
        }

        const response = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'PATCH',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${createdChangeRequest.change_request_number}`,
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
                  status: 'must match a schema in anyOf'
                }
              }
            }
          }
        })

        expect(response.statusCode).toBe(400)
      })
    })

    it('should response with 422 when invalid issues are passed', async () => {
      const issue = issueMock.create({
        connection_id: pubConn.id,
        database_name: pubDbEntry.raw_name,
        created_by: orgAdminUser.id
      })
      const createdIssue = await IssueService.createIssue(issue)

      const mockChangeRequest = changeRequestMock.create({
        created_by: orgAdminUser.id,
        connection_id: pubConn.id,
        database_name: pubDbEntry.raw_name
      })

      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      const payload = {
        related_issues: [createdIssue.issue_number, 999]
      }

      const response = await server.inject({
        headers: {
          authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
        },
        method: 'PATCH',
        url: `/v2/orgs/${org.slug}/databases/${pubDbEntry.slug}/change-requests/${createdChangeRequest.change_request_number}`,
        payload
      })

      expect(response.json()).toEqual({
        type: 'error',
        payload: {
          error: {
            message: 'One or more Issues not found.'
          }
        }
      })

      expect(response.statusCode).toBe(422)
    })

    testInvalidSortAuthHeaders({
      method: 'PATCH',
      url: '/v2/orgs/some-org-slug/databases/some-db-slug/change-requests/some-change-request-number'
    })

    paramsTester.testNotFound({
      method: 'PATCH',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number',
      userId: orgAdminUser.id,
      defaultPayload: { title: 'Updated Title' }
    })

    describe('for Public Connections', () => {
      describe('when the caller is an Org Owner', () => {
        it('should respond with 200 and update all change request fields', async () => {
          await testUpdateChangeRequest(
            orgAdminUser,
            orgAdminUser,
            pubConn,
            pubDbEntry,
            200,
            [label3],
            [label4]
          )
        })
      })
      describe('when the caller is an Org Member', () => {
        it('should respond with 200 and update all change request fields', async () => {
          await testUpdateChangeRequest(
            orgAdminUser,
            orgMemberUser1,
            pubConn,
            pubDbEntry,
            200,
            [label3],
            [label4]
          )
        })
      })
      describe('when the caller is an Non-Org Member', () => {
        describe('and is the change request creator', () => {
          it('should respond with 200 and update all change request fields', async () => {
            await testUpdateChangeRequest(
              nonOrgUser1,
              nonOrgUser1,
              pubConn,
              pubDbEntry,
              200,
              [label3],
              [label4]
            )
          })
        })
        describe('and is not the change request creator', () => {
          it('should respond with 403 and be forbidden from updating the change request', async () => {
            await testUpdateChangeRequest(
              orgAdminUser,
              nonOrgUser1,
              pubConn,
              pubDbEntry,
              403,
              [label3],
              [label4]
            )
          })
        })
      })
    })

    describe('for Private Connections', () => {
      describe('when the caller is an Org Owner', () => {
        it('should respond with 200 and update all change request fields', async () => {
          await testUpdateChangeRequest(
            orgAdminUser,
            orgAdminUser,
            prvConn,
            prvDbEntry,
            200,
            [label1],
            [label2]
          )
        })
      })

      describe('when the caller is an Org Member', () => {
        it('should respond with 200 and update all change request fields', async () => {
          await testUpdateChangeRequest(
            orgAdminUser,
            orgMemberUser1,
            prvConn,
            prvDbEntry,
            200,
            [label1],
            [label2]
          )
        })
      })
      describe('when the caller is an Non-Org Member', () => {
        it('should respond with 404', async () => {
          await testUpdateChangeRequest(
            orgAdminUser,
            nonOrgUser1,
            prvConn,
            prvDbEntry,
            404,
            [label1],
            [label2]
          )
        })
      })
    })

    it('should successfully update labels and reviewers without updating change request direct properties when they are unchanged', async () => {
      const createPayload = changeRequestMock.createPayload({
        title: 'Original Title',
        description: 'Original Description',
        labels: [label1.id],
        reviewers: [orgAdminUser.id]
      })

      const createResponse = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests`,
        payload: createPayload
      })

      const createdChangeRequest = createResponse.json().payload.change_request
      changeRequestMock.addPayloadId(createdChangeRequest.id)

      const updatePayload = {
        title: 'Original Title',
        description: 'Original Description',
        status: 'open',
        labels: [label2.id],
        reviewers: []
      }

      const updateResponse = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'PATCH',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${createdChangeRequest.change_request_number}`,
        payload: updatePayload
      })

      expect(updateResponse.json()).toEqual({
        type: 'update_change_request',
        payload: {
          change_request: {
            id: createdChangeRequest.id,
            connection_id: prvConn.id,
            database_name: prvDbEntry.raw_name,
            created_by: orgAdminUser.id,
            change_request_number: 1,
            title: updatePayload.title,
            description: updatePayload.description,
            status: updatePayload.status,
            created_at: createdChangeRequest.created_at,
            updated_at: expect.stringMatching(dateFormat),
            labels: [label2],
            changes: [],
            reviewers: [],
            related_issues: []
          }
        }
      })

      expect(updateResponse.statusCode).toBe(200)
    })

    it('should successfully update labels without updating change request direct properties when they are unchanged', async () => {
      const createPayload = changeRequestMock.createPayload({
        title: 'Original Title',
        description: 'Original Description',
        labels: [label1.id],
        reviewers: [orgAdminUser.id]
      })

      const createResponse = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests`,
        payload: createPayload
      })

      const createdChangeRequest = createResponse.json().payload.change_request
      changeRequestMock.addPayloadId(createdChangeRequest.id)

      const updatePayload = {
        title: 'Original Title',
        description: 'Original Description',
        status: 'open',
        labels: [label2.id]
      }

      const updateResponse = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'PATCH',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${createdChangeRequest.change_request_number}`,
        payload: updatePayload
      })

      const getOrgUsers = await OrganizationService.getMembersByIds(org.slug, [
        orgAdminUser.id
      ])

      expect(updateResponse.json()).toEqual({
        type: 'update_change_request',
        payload: {
          change_request: {
            id: createdChangeRequest.id,
            connection_id: prvConn.id,
            database_name: prvDbEntry.raw_name,
            created_by: orgAdminUser.id,
            change_request_number: 1,
            title: updatePayload.title,
            description: updatePayload.description,
            status: updatePayload.status,
            changes: [],
            created_at: createdChangeRequest.created_at,
            updated_at: expect.stringMatching(dateFormat),
            labels: [label2],
            reviewers: getOrgUsers,
            related_issues: []
          }
        }
      })

      expect(updateResponse.statusCode).toBe(200)
    })

    it('should successfully update reviewers without updating labels when they are unchanged', async () => {
      const createPayload = changeRequestMock.createPayload({
        title: 'Original Title',
        description: 'Original Description',
        labels: [label1.id],
        reviewers: [orgAdminUser.id, orgMemberUser1.id]
      })

      const createResponse = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests`,
        payload: createPayload
      })

      const createdChangeRequest = createResponse.json().payload.change_request
      changeRequestMock.addPayloadId(createdChangeRequest.id)

      const updatePayload = {
        title: 'Original Title',
        description: 'Original Description',
        status: 'open',
        reviewers: [orgMemberUser1.id]
      }

      const updateResponse = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'PATCH',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${createdChangeRequest.change_request_number}`,
        payload: updatePayload
      })

      const getOrgUsers = await OrganizationService.getMembersByIds(org.slug, [
        orgMemberUser1.id
      ])

      expect(updateResponse.json()).toEqual({
        type: 'update_change_request',
        payload: {
          change_request: {
            id: createdChangeRequest.id,
            connection_id: prvConn.id,
            database_name: prvDbEntry.raw_name,
            created_by: orgAdminUser.id,
            change_request_number: 1,
            title: updatePayload.title,
            description: updatePayload.description,
            status: updatePayload.status,
            created_at: createdChangeRequest.created_at,
            updated_at: expect.stringMatching(dateFormat),
            labels: [label1],
            changes: [],
            reviewers: getOrgUsers,
            related_issues: []
          }
        }
      })

      expect(updateResponse.statusCode).toBe(200)
    })

    describe('for field-specific updates', () => {
      it('should successfully update change request without affecting reviewers or labels', async () => {
        const createPayload = changeRequestMock.createPayload({
          title: 'Original Title',
          description: 'Original Description',
          labels: [label1.id],
          reviewers: [orgAdminUser.id, orgMemberUser1.id]
        })

        const createResponse = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'POST',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests`,
          payload: createPayload
        })

        const createdChangeRequest =
          createResponse.json().payload.change_request
        changeRequestMock.addPayloadId(createdChangeRequest.id)

        const updatePayload = {
          title: 'Updated Title',
          description: 'Updated Description',
          status: 'closed'
        }

        const updateResponse = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'PATCH',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${createdChangeRequest.change_request_number}`,
          payload: updatePayload
        })

        const getOrgUsers = await OrganizationService.getMembersByIds(
          org.slug,
          [orgAdminUser.id, orgMemberUser1.id]
        )

        expect(updateResponse.json()).toEqual({
          type: 'update_change_request',
          payload: {
            change_request: {
              id: createdChangeRequest.id,
              connection_id: prvConn.id,
              database_name: prvDbEntry.raw_name,
              created_by: orgAdminUser.id,
              change_request_number: 1,
              title: updatePayload.title,
              changes: [],
              description: updatePayload.description,
              status: updatePayload.status,
              created_at: createdChangeRequest.created_at,
              updated_at: expect.stringMatching(dateFormat),
              labels: [label1],
              reviewers: expect.arrayContaining(getOrgUsers),
              related_issues: []
            }
          }
        })

        expect(updateResponse.statusCode).toBe(200)
      })

      it('should successfully close a change request', async () => {
        const createPayload = changeRequestMock.createPayload({
          title: 'Original Title',
          description: 'Original Description',
          labels: [label1.id],
          reviewers: [orgAdminUser.id, orgMemberUser1.id]
        })

        const createResponse = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'POST',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests`,
          payload: createPayload
        })

        const createdChangeRequest =
          createResponse.json().payload.change_request
        changeRequestMock.addPayloadId(createdChangeRequest.id)

        const updatePayload = {
          title: 'Original Title',
          description: 'Original Description',
          status: 'closed'
        }

        const updateResponse = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'PATCH',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${createdChangeRequest.change_request_number}`,
          payload: updatePayload
        })

        const getOrgUsers = await OrganizationService.getMembersByIds(
          org.slug,
          [orgAdminUser.id, orgMemberUser1.id]
        )

        expect(updateResponse.json()).toEqual({
          type: 'update_change_request',
          payload: {
            change_request: {
              id: createdChangeRequest.id,
              connection_id: prvConn.id,
              database_name: prvDbEntry.raw_name,
              created_by: orgAdminUser.id,
              change_request_number: 1,
              title: updatePayload.title,
              description: updatePayload.description,
              status: updatePayload.status,
              changes: [],
              created_at: createdChangeRequest.created_at,
              updated_at: expect.stringMatching(dateFormat),
              labels: [label1],
              reviewers: expect.arrayContaining(getOrgUsers),
              related_issues: []
            }
          }
        })

        expect(updateResponse.statusCode).toBe(200)
      })

      it('should successfully re-open a closed change request', async () => {
        const createPayload = changeRequestMock.createPayload({
          title: 'Original Title',
          description: 'Original Description',
          labels: [label1.id],
          reviewers: [orgAdminUser.id, orgMemberUser1.id]
        })

        const createResponse = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'POST',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests`,
          payload: createPayload
        })

        const createdChangeRequest =
          createResponse.json().payload.change_request
        changeRequestMock.addPayloadId(createdChangeRequest.id)

        const updatePayload = {
          title: 'Original Title',
          description: 'Original Description',
          status: 'closed'
        }

        const updateResponse = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'PATCH',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${createdChangeRequest.change_request_number}`,
          payload: updatePayload
        })

        expect(updateResponse.statusCode).toBe(200)

        const updatePayload2 = {
          title: 'Reopen Title',
          description: 'Reopen Description',
          status: 'open'
        }

        const updateResponse2 = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'PATCH',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${createdChangeRequest.change_request_number}`,
          payload: updatePayload2
        })

        const getOrgUsers = await OrganizationService.getMembersByIds(
          org.slug,
          [orgAdminUser.id, orgMemberUser1.id]
        )

        expect(updateResponse2.json()).toEqual({
          type: 'update_change_request',
          payload: {
            change_request: {
              id: createdChangeRequest.id,
              connection_id: prvConn.id,
              database_name: prvDbEntry.raw_name,
              created_by: orgAdminUser.id,
              change_request_number: 1,
              title: updatePayload2.title,
              description: updatePayload2.description,
              status: updatePayload2.status,
              changes: [],
              related_issues: [],
              created_at: createdChangeRequest.created_at,
              updated_at: expect.stringMatching(dateFormat),
              labels: [label1],
              reviewers: expect.arrayContaining(getOrgUsers)
            }
          }
        })

        expect(updateResponse.statusCode).toBe(200)
      })
    })
  })

  describe('execute_change_request operation', () => {
    paramsTester.testInvalidParams({
      method: 'PATCH',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/execute',
      userId: orgAdminUser.id
    })

    testInvalidSortAuthHeaders({
      method: 'PATCH',
      url: '/v2/orgs/some-org-slug/databases/some-db-slug/change-requests/some-change-request-number/execute'
    })

    paramsTester.testNotFound({
      method: 'PATCH',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/execute',
      userId: orgAdminUser.id
    })

    describe('public connections', () => {
      describe('when the caller is an Org Owner', () => {
        it('responds with 200 and sets status to executing', async () => {
          await testExecuteChangeRequest(
            pubConn,
            pubDbEntry,
            200,
            orgAdminUser,
            orgAdminUser,
            orgMemberUser1
          )
        })
      })

      describe('when the caller is an Org Member', () => {
        it('responds with 403', async () => {
          await testExecuteChangeRequest(
            pubConn,
            pubDbEntry,
            403,
            orgAdminUser,
            orgMemberUser1,
            orgMemberUser1
          )
        })
      })

      describe('when the caller is an Non-Org Member', () => {
        it('responds with 403', async () => {
          await testExecuteChangeRequest(
            pubConn,
            pubDbEntry,
            403,
            orgAdminUser,
            nonOrgUser1,
            orgMemberUser1
          )
        })
      })
    })

    describe('private connections', () => {
      describe('when the caller is an Org Owner', () => {
        it('responds with 200 and sets status to executing', async () => {
          await testExecuteChangeRequest(
            prvConn,
            prvDbEntry,
            200,
            orgAdminUser,
            orgAdminUser,
            orgMemberUser1
          )
        })
      })

      describe('when the caller is an Org Member', () => {
        it('responds with 403', async () => {
          await testExecuteChangeRequest(
            prvConn,
            prvDbEntry,
            403,
            orgAdminUser,
            orgMemberUser1,
            orgMemberUser1
          )
        })
      })

      describe('when the caller is an Non-Org Member', () => {
        it('responds with 404', async () => {
          await testExecuteChangeRequest(
            prvConn,
            prvDbEntry,
            404,
            orgAdminUser,
            nonOrgUser1,
            orgMemberUser1
          )
        })
      })
    })

    describe('when the change request has not been approved', () => {
      it('responds with 409', async () => {
        await testExecuteChangeRequest(
          pubConn,
          pubDbEntry,
          409,
          orgAdminUser,
          orgAdminUser
        )
      })
    })
  })
})
