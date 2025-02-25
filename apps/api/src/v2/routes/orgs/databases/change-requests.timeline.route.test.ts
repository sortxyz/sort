import { randomUUID } from 'node:crypto'

import { getDb } from '@sort/shared'
import { dateFormat } from '@sort/shared/constants/type-mask.constant'
import { ChangeRequestCommentMock } from '@sort/shared/mocks/change-requests/change-request-comment.mock'
import { ChangeRequestMock } from '@sort/shared/mocks/change-requests/change-request.mock'
import { ChangeMock } from '@sort/shared/mocks/change-requests/change.mock'
import { ConnectionMock } from '@sort/shared/mocks/connection.mock'
import { MetadataDatabaseMock } from '@sort/shared/mocks/metadata.mock'
import { OrganizationMock } from '@sort/shared/mocks/org.mock'
import { ReviewMock } from '@sort/shared/mocks/review.mock'
import { UserMock } from '@sort/shared/mocks/user.mock'
import { addChangeRequestHistory } from '@sort/shared/services/change-requests/change-request.service'
import * as ChangeRequestService from '@sort/shared/services/change-requests/change-request.service'
import * as ConnectionService from '@sort/shared/services/connection.service'
import * as MetadataDatabaseService from '@sort/shared/services/kysely/metadata/database.service'
import * as OrganizationService from '@sort/shared/services/org.service'
import * as UserService from '@sort/shared/services/user.service'

import {
  createKysely,
  disconnectKysely
} from '../../../../global/services/kysely.service'
import { getTestServer } from '../../../../global/utils/test.util'
import { createSortJwt } from '../../../utils/jwt.util'
import {
  testInvalidSortAuthHeaders,
  ParamsTester,
  expectNotFound
} from '../../../utils/test.util'

import type { FullChange } from '@sort/shared/schemas/change.schema'
import type { User } from '@sort/shared/types/user.type'

describe('change request timeline', () => {
  let server: Awaited<ReturnType<typeof getTestServer>>

  const userMock = new UserMock()
  const orgMock = new OrganizationMock()
  const dbMock = new MetadataDatabaseMock()
  const connMock = new ConnectionMock()
  const changeMock = new ChangeMock()
  const changeRequestCommentMock = new ChangeRequestCommentMock()
  const reviewMock = new ReviewMock()
  const changeRequestMock = new ChangeRequestMock()

  const orgAdminUser = userMock.create()
  const nonOrgUser1 = userMock.create()
  const orgMemberUser1 = userMock.create()
  const org = orgMock.create({ created_by: orgAdminUser.id })
  const prvConn = connMock.create({
    organization_id: org.id,
    created_by: orgAdminUser.id
  })

  const prvDbEntry = dbMock.create({
    organization_id: org.id,
    connection_id: prvConn.id,
    raw_name: 'sort_xyz'
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

  const setupTests = async () => {
    await UserService.createUser(orgAdminUser)
    await UserService.createUser(nonOrgUser1)
    await UserService.createUser(orgMemberUser1)
    await OrganizationService.create(org)
    await OrganizationService.addMember(org.slug, orgMemberUser1.id, 'member')
    await ConnectionService.create(prvConn)
    await MetadataDatabaseService.insertMetadataDb(getDb(), prvDbEntry)
  }

  async function cleanupTests() {
    await changeRequestCommentMock.removeAll()
    await reviewMock.removeAll()
    await changeMock.removeAll()
    await changeRequestMock.removeAll()
    await connMock.removeAll()
    await dbMock.removeAll()
    await orgMock.removeAll(true)
    await userMock.removeAll()
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

  describe('list_change_request_timeline operation', () => {
    paramsTester.testInvalidParams({
      method: 'GET',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/timeline',
      userId: orgAdminUser.id
    })

    testInvalidSortAuthHeaders({
      method: 'GET',
      url: '/v2/orgs/some-org-slug/databases/some-db-slug/change-requests/some-change-request-number/timeline'
    })

    it('should respond with 200 with a correct timeline events array', async () => {
      const mockChangeRequest = changeRequestMock.create({
        created_by: orgAdminUser.id,
        connection_id: prvConn.id,
        database_name: prvDbEntry.raw_name
      })

      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      await getDb()
        .transaction()
        .execute(async trx => {
          await ChangeRequestService.addHistoryItem(
            {
              changeRequestId: mockChangeRequest.id,
              userId: orgAdminUser.id,
              currentDate: new Date(),
              trx
            },
            'ADD_CHANGE',
            {
              change: {
                id: '1bb72947-dbc0-4583-ac4b-b7db77e458e0',
                index: 0,
                action: 'ADD',
                fields: [
                  {
                    id: '2ba88cc0-9722-43af-a98b-00bd022cc094',
                    change_id: 'fd9143a0-35ef-4879-925f-a78348309539',
                    uuid_value: 'fc0e7239-ee25-4eec-8da1-e4575617ec99',
                    column_name: 'id',
                    is_value_null: false
                  },
                  {
                    id: '22876633-dcbf-46e0-845d-7d95d801fb2a',
                    change_id: 'fd9143a0-35ef-4879-925f-a78348309539',
                    uuid_value: null,
                    column_name: 'test_uuid',
                    is_value_null: true
                  },
                  {
                    id: '848a3b1b-1533-4e04-b900-285742add7b2',
                    change_id: 'fd9143a0-35ef-4879-925f-a78348309539',
                    column_name: 'test_numeric',
                    is_value_null: true,
                    numeric_value: null
                  },
                  {
                    id: '4af64617-4091-4b9a-b6c0-ae06b5bc1bdb',
                    change_id: 'fd9143a0-35ef-4879-925f-a78348309539',
                    column_name: 'test_boolean',
                    boolean_value: null,
                    is_value_null: true
                  },
                  {
                    id: '6d2a0390-b9d5-4e22-8cc6-3bde2ee2996f',
                    change_id: 'fd9143a0-35ef-4879-925f-a78348309539',
                    json_value: null,
                    column_name: 'test_jsonb',
                    is_value_null: true
                  },
                  {
                    id: 'd3f87f63-28e3-4097-9f63-d1c9f0f4ba34',
                    change_id: 'fd9143a0-35ef-4879-925f-a78348309539',
                    column_name: 'test_text',
                    string_value: null,
                    is_value_null: true
                  },
                  {
                    id: '3f562e10-8a27-4b97-86cd-9abf0d2e2c6b',
                    change_id: 'fd9143a0-35ef-4879-925f-a78348309539',
                    date_value: null,
                    column_name: 'test_timestamp',
                    is_value_null: true
                  },
                  {
                    id: '4dad431c-d843-44bb-b25a-e33c1276ac5f',
                    change_id: 'fd9143a0-35ef-4879-925f-a78348309539',
                    column_name: 'test_binary',
                    binary_value: null,
                    is_value_null: true
                  },
                  {
                    id: 'c3537816-35cd-433f-b6ad-bd9bdaddedfd',
                    change_id: 'fd9143a0-35ef-4879-925f-a78348309539',
                    date_value: null,
                    column_name: 'test_date',
                    is_value_null: true
                  },
                  {
                    id: '8f853c0d-64c8-4c74-b88b-2f7d6f41d419',
                    change_id: 'fd9143a0-35ef-4879-925f-a78348309539',
                    date_value: null,
                    column_name: 'test_timestamptz',
                    is_value_null: true
                  }
                ],
                primary_keys: [],
                connection_id: '4cc6b190-4737-4f64-8de3-57a13abbdcec',
                change_request_id: '573dc8aa-f174-4a2f-bb01-f616502eb25f',
                metadata_table_name: 'change_request_test',
                metadata_schema_name: 'test',
                metadata_database_name: 'sort_xyz'
              }
            }
          )
        })

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'GET',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${createdChangeRequest.change_request_number}/timeline`
      })

      // eslint-disable-next-line @typescript-eslint/naming-convention
      const { change_request_timeline } = response.json().payload
      expect(change_request_timeline).toHaveLength(2)
      expect(change_request_timeline).toEqual([
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: orgAdminUser.id,
            username: orgAdminUser.username,
            name: orgAdminUser.name,
            picture: orgAdminUser.picture
          },
          action_type: 'CREATE_CHANGE_REQUEST',
          action_details: {
            change_request_number: createdChangeRequest.change_request_number
          },
          created_at: expect.stringMatching(dateFormat)
        },
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: orgAdminUser.id,
            username: orgAdminUser.username,
            name: orgAdminUser.name,
            picture: orgAdminUser.picture
          },
          action_type: 'ADD_CHANGE',
          action_details: {
            change: {
              id: '1bb72947-dbc0-4583-ac4b-b7db77e458e0',
              index: 0,
              action: 'ADD',
              fields: [
                {
                  id: '2ba88cc0-9722-43af-a98b-00bd022cc094',
                  change_id: 'fd9143a0-35ef-4879-925f-a78348309539',
                  uuid_value: 'fc0e7239-ee25-4eec-8da1-e4575617ec99',
                  column_name: 'id',
                  is_value_null: false
                },
                {
                  id: '22876633-dcbf-46e0-845d-7d95d801fb2a',
                  change_id: 'fd9143a0-35ef-4879-925f-a78348309539',
                  uuid_value: null,
                  column_name: 'test_uuid',
                  is_value_null: true
                },
                {
                  id: '848a3b1b-1533-4e04-b900-285742add7b2',
                  change_id: 'fd9143a0-35ef-4879-925f-a78348309539',
                  column_name: 'test_numeric',
                  is_value_null: true,
                  numeric_value: null
                },
                {
                  id: '4af64617-4091-4b9a-b6c0-ae06b5bc1bdb',
                  change_id: 'fd9143a0-35ef-4879-925f-a78348309539',
                  column_name: 'test_boolean',
                  boolean_value: null,
                  is_value_null: true
                },
                {
                  id: '6d2a0390-b9d5-4e22-8cc6-3bde2ee2996f',
                  change_id: 'fd9143a0-35ef-4879-925f-a78348309539',
                  json_value: null,
                  column_name: 'test_jsonb',
                  is_value_null: true
                },
                {
                  id: 'd3f87f63-28e3-4097-9f63-d1c9f0f4ba34',
                  change_id: 'fd9143a0-35ef-4879-925f-a78348309539',
                  column_name: 'test_text',
                  string_value: null,
                  is_value_null: true
                },
                {
                  id: '3f562e10-8a27-4b97-86cd-9abf0d2e2c6b',
                  change_id: 'fd9143a0-35ef-4879-925f-a78348309539',
                  date_value: null,
                  column_name: 'test_timestamp',
                  is_value_null: true
                },
                {
                  id: '4dad431c-d843-44bb-b25a-e33c1276ac5f',
                  change_id: 'fd9143a0-35ef-4879-925f-a78348309539',
                  column_name: 'test_binary',
                  binary_value: null,
                  is_value_null: true
                },
                {
                  id: 'c3537816-35cd-433f-b6ad-bd9bdaddedfd',
                  change_id: 'fd9143a0-35ef-4879-925f-a78348309539',
                  date_value: null,
                  column_name: 'test_date',
                  is_value_null: true
                },
                {
                  id: '8f853c0d-64c8-4c74-b88b-2f7d6f41d419',
                  change_id: 'fd9143a0-35ef-4879-925f-a78348309539',
                  date_value: null,
                  column_name: 'test_timestamptz',
                  is_value_null: true
                }
              ],
              primary_keys: [],
              connection_id: '4cc6b190-4737-4f64-8de3-57a13abbdcec',
              change_request_id: '573dc8aa-f174-4a2f-bb01-f616502eb25f',
              metadata_table_name: 'change_request_test',
              metadata_schema_name: 'test',
              metadata_database_name: 'sort_xyz'
            }
          },
          created_at: expect.stringMatching(dateFormat)
        }
      ])
      expect(response.statusCode).toBe(200)
    })

    it('should respond with 401 for unauthorized access', async () => {
      const mockChangeRequest = changeRequestMock.create({
        created_by: orgAdminUser.id,
        connection_id: prvConn.id,
        database_name: prvDbEntry.raw_name
      })

      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(nonOrgUser1.id)}` },
        method: 'GET',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${createdChangeRequest.change_request_number}/timeline`
      })

      expectNotFound(response, 'database')
    })

    paramsTester.testNotFound({
      method: 'GET',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/timeline',
      userId: orgAdminUser.id
    })

    describe('has permissions and', () => {
      it('should return a timeline for a given change_request_number', async () => {
        const payload = changeRequestMock.createPayload({
          title: 'Detailed Test Change Request',
          description: 'This change request has all possible fields defined.'
        })

        const response1 = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'POST',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests`,
          payload
        })

        const createdChangeRequest = response1.json().payload.change_request
        changeRequestMock.addPayloadId(createdChangeRequest.id)

        const commentPayload = changeRequestCommentMock.createPayload()

        const commentResponse = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'POST',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${createdChangeRequest.change_request_number}/comments`,
          payload: commentPayload
        })

        expect(commentResponse.statusCode).toBe(201)

        changeRequestCommentMock.addPayloadId(
          commentResponse.json().payload.change_request_comment.id
        )

        // include change events

        const addChangeId = randomUUID()
        const originalChange = {
          id: addChangeId,
          change_request_id: createdChangeRequest.id,
          connection_id: prvDbEntry.connection_id,
          index: 0,
          action: 'ADD',
          metadata_database_name: 'my_test_database',
          metadata_schema_name: 'my_test_schema',
          metadata_table_name: 'my_test_table',
          fields: [
            {
              column_name: 'id',
              string_value: 'uno',
              id: randomUUID(),
              change_id: addChangeId,
              is_value_null: false
            }
          ],
          primary_keys: []
        } satisfies FullChange

        await addChangeRequestHistory({
          history: {
            id: randomUUID(),
            change_request_id: createdChangeRequest.id,
            action_type: 'ADD_CHANGE',
            action_details: {
              change: originalChange
            },
            created_at: new Date()
          },
          userId: orgAdminUser.id
        })

        await addChangeRequestHistory({
          history: {
            id: randomUUID(),
            change_request_id: createdChangeRequest.id,
            action_type: 'UPDATE_CHANGE',
            action_details: {
              previous_change: originalChange,
              change: {
                id: addChangeId,
                change_request_id: createdChangeRequest.id,
                connection_id: prvDbEntry.connection_id,
                index: 0,
                action: 'ADD',
                metadata_database_name: 'my_test_database',
                metadata_schema_name: 'my_test_schema',
                metadata_table_name: 'my_test_table',
                fields: [
                  {
                    column_name: 'id',
                    string_value: 'one',
                    id: randomUUID(),
                    change_id: addChangeId,
                    is_value_null: false
                  }
                ],
                primary_keys: []
              }
            },
            created_at: new Date()
          },
          userId: orgAdminUser.id
        })

        await addChangeRequestHistory({
          history: {
            id: randomUUID(),
            change_request_id: createdChangeRequest.id,
            action_type: 'DELETE_CHANGE',
            action_details: {
              change: {
                id: addChangeId,
                change_request_id: createdChangeRequest.id,
                connection_id: prvDbEntry.connection_id,
                index: 0,
                action: 'ADD',
                metadata_database_name: 'my_test_database',
                metadata_schema_name: 'my_test_schema',
                metadata_table_name: 'my_test_table',
                fields: [
                  {
                    column_name: 'id',
                    string_value: 'one',
                    id: randomUUID(),
                    change_id: addChangeId,
                    is_value_null: false
                  }
                ],
                primary_keys: []
              }
            },
            created_at: new Date()
          },
          userId: orgAdminUser.id
        })

        await approveChangeRequest({
          author: orgAdminUser,
          changeRequestId: createdChangeRequest.id
        })

        const executeResponse = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'PATCH',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${createdChangeRequest.change_request_number}/execute`
        })

        expect(executeResponse.statusCode).toBe(200)

        const response2 = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'GET',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${createdChangeRequest.change_request_number}/timeline`
        })

        expect(response2.json()).toEqual({
          type: 'list_change_request_timeline',
          payload: {
            change_request_timeline: [
              {
                id: expect.any(String),
                change_request_id: createdChangeRequest.id,
                user: expect.any(Object),
                action_details: {
                  change_request_number:
                    createdChangeRequest.change_request_number
                },
                action_type: 'CREATE_CHANGE_REQUEST',
                created_at: expect.stringMatching(dateFormat)
              },
              {
                id: expect.any(String),
                change_request_id: createdChangeRequest.id,
                user: expect.any(Object),
                action_details: {
                  comment_id: expect.any(String),
                  change_id: null,
                  review_id: null,
                  content: commentPayload.content
                },
                action_type: 'ADD_COMMENT',
                created_at: expect.stringMatching(dateFormat),
                permissions: {
                  delete_comment: {
                    value: true,
                    message:
                      'You do not have permission to delete this comment.'
                  },
                  update_comment: {
                    value: true,
                    message:
                      'You do not have permission to update this comment.'
                  }
                }
              },
              {
                id: expect.any(String),
                change_request_id: createdChangeRequest.id,
                user: expect.any(Object),
                action_details: expect.any(Object),
                action_type: 'ADD_CHANGE',
                created_at: expect.stringMatching(dateFormat)
              },
              {
                id: expect.any(String),
                change_request_id: createdChangeRequest.id,
                user: expect.any(Object),
                action_details: expect.any(Object),
                action_type: 'UPDATE_CHANGE',
                created_at: expect.stringMatching(dateFormat)
              },
              {
                id: expect.any(String),
                change_request_id: createdChangeRequest.id,
                user: expect.any(Object),
                action_details: expect.any(Object),
                action_type: 'DELETE_CHANGE',
                created_at: expect.stringMatching(dateFormat)
              },
              {
                id: expect.any(String),
                change_request_id: createdChangeRequest.id,
                user: expect.any(Object),
                action_details: {
                  review_id: expect.any(String),
                  event_type: 'APPROVE',
                  text: expect.any(String)
                },
                action_type: 'ADD_REVIEW',
                created_at: expect.stringMatching(dateFormat)
              },
              {
                id: expect.any(String),
                change_request_id: createdChangeRequest.id,
                user: expect.any(Object),
                action_details: {
                  change_request_job_id: expect.any(String)
                },
                action_type: 'START_EXECUTE',
                created_at: expect.stringMatching(dateFormat)
              }
            ]
          }
        })
        expect(response2.statusCode).toBe(200)
      })

      it('should return a timeline with a member created comment, that the org_admin can update', async () => {
        const payload = changeRequestMock.createPayload({
          title: 'Detailed Test Change Request',
          description: 'This change request has all possible fields defined.'
        })

        const response1 = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgMemberUser1.id)}`
          },
          method: 'POST',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests`,
          payload
        })

        const createdChangeRequest = response1.json().payload.change_request
        changeRequestMock.addPayloadId(createdChangeRequest.id)

        const commentPayload = changeRequestCommentMock.createPayload()
        const commentResponse = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgMemberUser1.id)}`
          },
          method: 'POST',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${createdChangeRequest.change_request_number}/comments`,
          payload: commentPayload
        })

        expect(commentResponse.statusCode).toBe(201)

        changeRequestCommentMock.addPayloadId(
          commentResponse.json().payload.change_request_comment.id
        )

        const response2 = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'GET',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${createdChangeRequest.change_request_number}/timeline`
        })

        expect(response2.json()).toEqual({
          type: 'list_change_request_timeline',
          payload: {
            change_request_timeline: [
              {
                id: expect.any(String),
                change_request_id: createdChangeRequest.id,
                user: expect.any(Object),
                action_details: {
                  change_request_number:
                    createdChangeRequest.change_request_number
                },
                action_type: 'CREATE_CHANGE_REQUEST',
                created_at: expect.stringMatching(dateFormat)
              },
              {
                id: expect.any(String),
                change_request_id: createdChangeRequest.id,
                user: expect.any(Object),
                action_details: {
                  comment_id: expect.any(String),
                  change_id: null,
                  review_id: null,
                  content: commentPayload.content
                },
                action_type: 'ADD_COMMENT',
                created_at: expect.stringMatching(dateFormat),
                permissions: {
                  delete_comment: {
                    value: true,
                    message:
                      'You do not have permission to delete this comment.'
                  },
                  update_comment: {
                    value: false,
                    message:
                      'You do not have permission to update this comment.'
                  }
                }
              }
            ]
          }
        })
        expect(response2.statusCode).toBe(200)
      })
    })
  })
})
