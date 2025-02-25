import { randomUUID } from 'node:crypto'

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
import { UserMock } from '@sort/shared/mocks/user.mock'
import * as ChangeRequestService from '@sort/shared/services/change-requests/change-request.service'
import * as ChangeService from '@sort/shared/services/changes/change.service'
import * as UpdateChangeService from '@sort/shared/services/changes/update-change.service'
import * as ConnectionService from '@sort/shared/services/connection.service'
import * as MetadataDatabaseService from '@sort/shared/services/kysely/metadata/database.service'
import * as MetadataTableService from '@sort/shared/services/kysely/metadata/table.service'
import * as SnapshotService from '@sort/shared/services/kysely/snapshot/snapshot.service'
import * as LabelService from '@sort/shared/services/label.service'
import * as OrganizationService from '@sort/shared/services/org.service'
import * as UserService from '@sort/shared/services/user.service'

import { config } from '../../../../config/bootstrap'
import {
  createKysely,
  disconnectKysely,
  getDb
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
  RequestUpdateChange
} from '@sort/shared/schemas/change.schema'
import type {
  ChangeFieldValueInsert,
  ChangePrimaryKeyInsert
} from '@sort/shared/types/change-request.types'
import type * as ConnectionType from '@sort/shared/types/kysely/connection/connection.type'
import type { SortDB } from '@sort/shared/types/kysely.type'
import type { User } from '@sort/shared/types/user.type'

type MetadataDatabase = SortDB['metadata_database']
type SubjectAction = 'ADD' | 'MODIFY' | 'DELETE'

describe('/v2 change-request changes routes', () => {
  const userMock = new UserMock()
  const orgMock = new OrganizationMock()
  const dbMock = new MetadataDatabaseMock()
  const labelMock = new LabelMock()
  const connMock = new ConnectionMock()
  const changeRequestMock = new ChangeRequestMock()
  const changeRequestCommentMock = new ChangeRequestCommentMock()
  const tableMock = new MetadataTableMock()
  const changeMock = new ChangeMock()
  const snapshotMock = new SnapshotMock()
  const testTableMock = new ChangeRequestTestTableMock()

  const nonOrgUser1 = userMock.create()
  const nonOrgUser2 = userMock.create()
  const orgAdminUser = userMock.create()
  const orgMemberUser1 = userMock.create()
  const orgMemberUser2 = userMock.create()
  const sorthubSvcAccount = userMock.create({
    email: config.SORTUI_SERVICE_ACCOUNT_EMAIL
  })
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

  const defaultPayload = {
    action: 'ADD',
    database_name: prvDbEntry.raw_name,
    schema_name: 'test',
    table_name: 'change_request_test',
    fields: [],
    primary_keys: []
  }

  let server: Awaited<ReturnType<typeof getTestServer>>

  async function setupTests() {
    await UserService.createUser(orgAdminUser)
    await UserService.createUser(nonOrgUser1)
    await UserService.createUser(nonOrgUser2)
    await UserService.createUser(orgMemberUser1)
    await UserService.createUser(orgMemberUser2)
    await UserService.createUser(sorthubSvcAccount)
    await OrganizationService.create(org)
    await OrganizationService.addMember(org.slug, orgMemberUser1.id, 'member')
    await OrganizationService.addMember(org.slug, orgMemberUser2.id, 'member')
    await ConnectionService.create(prvConn)
    await ConnectionService.create(pubConn)
    await createSnapshotMocks(prvConn.id)
    await createSnapshotMocks(pubConn.id)
    await MetadataDatabaseService.insertMetadataDb(getDb(), prvDbEntry)
    await MetadataDatabaseService.insertMetadataDb(getDb(), pubDbEntry)
    await LabelService.createDatabaseLabel(label1)
    await LabelService.createDatabaseLabel(label2)
  }

  async function createSnapshotMocks(connectionId: string) {
    const snapshotPubMock = snapshotMock.create({
      connection_id: connectionId,
      status: 'COMPLETED',
      creator: orgAdminUser.id
    })
    const snapshotDbMock = snapshotMock.DatabaseMock.create({
      snapshot_id: snapshotPubMock.id,
      name: 'sort_xyz'
    })
    const snapshotSchemaMock = snapshotMock.SchemaMock.create({
      database_id: snapshotDbMock.id,
      name: 'test'
    })
    const snapshotTableMock1 = snapshotMock.TableMock.create({
      schema_id: snapshotSchemaMock.id,
      name: 'change_request_test'
    })
    const snapshotTableMock2 = snapshotMock.TableMock.create({
      schema_id: snapshotSchemaMock.id,
      name: 'change_request_test_no_primary_keys'
    })
    const snapshotColumnMock21 = snapshotMock.ColumnMock.create({
      table_id: snapshotTableMock2.id,
      name: 'id',
      type: 'uuid',
      nullable: false,
      has_default: true,
      is_primary_key: true,
      position: 0
    })
    const snapshotColumnMock1 = snapshotMock.ColumnMock.create({
      table_id: snapshotTableMock1.id,
      name: 'id',
      type: 'uuid',
      nullable: false,
      is_primary_key: true,
      position: 0
    })
    const snapshotColumnMock2 = snapshotMock.ColumnMock.create({
      table_id: snapshotTableMock1.id,
      name: 'test_text',
      type: 'text',
      nullable: true,
      position: 1
    })
    await SnapshotService.insertSnapshot(getDb(), snapshotPubMock)
    await snapshotMock.DatabaseMock.insert(snapshotDbMock)
    await snapshotMock.SchemaMock.insert(snapshotSchemaMock)
    await snapshotMock.TableMock.insert({
      connectionId,
      databaseName: snapshotDbMock.name,
      schemaName: snapshotSchemaMock.name,
      table: snapshotTableMock1
    })
    await snapshotMock.TableMock.insert({
      connectionId,
      databaseName: snapshotDbMock.name,
      schemaName: snapshotSchemaMock.name,
      table: snapshotTableMock2
    })
    await snapshotMock.ColumnMock.insert(snapshotColumnMock1)
    await snapshotMock.ColumnMock.insert(snapshotColumnMock2)
    await snapshotMock.ColumnMock.insert(snapshotColumnMock21)
  }

  async function cleanupTests() {
    await changeRequestCommentMock.removeAll()
    await testTableMock.removeAll()
    await snapshotMock.removeAll()
    await changeMock.removeAll()
    await tableMock.removeAll()
    await changeRequestMock.removeAll()
    await labelMock.removeAll()
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

  afterEach(async () => {
    await changeMock.removeAll()
    await tableMock.removeAll()
    await changeRequestMock.removeAll()
  })

  afterAll(async () => {
    await cleanupTests()
    await disconnectKysely()
  })

  const createMockChangeRequest = async (
    creator: User,
    visibility: 'public' | 'private'
  ) => {
    const connection = visibility === 'public' ? pubConn : prvConn
    const database = visibility === 'public' ? pubDbEntry : prvDbEntry

    const mockChangeRequest = changeRequestMock.create({
      created_by: creator.id,
      connection_id: connection.id,
      database_name: database.raw_name
    })

    return await ChangeRequestService.createChangeRequest(mockChangeRequest)
  }

  const testInvalidStatus = (
    method: 'POST' | 'PATCH' | 'DELETE',
    payload?: RequestChange | RequestUpdateChange | RequestChange[],
    batch?: boolean
  ) => {
    it('should respond with 409 when change request is not open or approved', async () => {
      const changeRequest = await createMockChangeRequest(
        orgAdminUser,
        'private'
      )

      await getDb()
        .updateTable('change_request')
        .set({
          status: 'applied'
        })
        .where('id', '=', changeRequest.id)
        .execute()

      const path = batch
        ? '/batch'
        : method !== 'POST'
          ? `/${randomUUID()}`
          : ''

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method,
        payload,
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${changeRequest.change_request_number}/changes${path}`
      })

      expect(response.json()).toEqual({
        type: 'error',
        payload: {
          error: {
            message:
              'Unable to modify a Change Request which is not currently open or approved.'
          }
        }
      })

      expect(response.statusCode).toBe(409)
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
    change_id: {
      expectedNotFoundEntity: 'change',
      expectedValidationError: 'must be a valid GUID (UUID v4)',
      invalidValue: 'invalid-change-id',
      validValue: randomUUID(),
      notFoundValue: randomUUID()
    }
  })

  const testGetChanges = async (
    creator: User,
    caller: User,
    connection: ConnectionType.ConnectionSelectWithEncryption,
    database: MetadataDatabase,
    statusCode: number
  ) => {
    const changeRequest = await createMockChangeRequest(
      creator,
      connection.visibility
    )

    const pubTableEntry = tableMock.create({
      connection_id: connection.id,
      raw_database_name: database.raw_name,
      raw_schema_name: 'public',
      raw_name: 'users'
    })
    await MetadataTableService.insertTable(pubTableEntry)

    const mockChange = changeMock.create({
      change_request_id: changeRequest.id,
      action: 'ADD',
      connection_id: connection.id,
      index: 0,
      metadata_database_name: database.raw_name,
      metadata_schema_name: 'public',
      metadata_table_name: 'users'
    })

    const mockFieldValue = changeMock.createFieldValue({
      change_id: mockChange.id,
      column_name: 'id',
      string_value: randomUUID()
    })

    const createdChange = await ChangeService.insertChange(getDb(), mockChange)
    const createdFieldValue = await ChangeService.insertChangeFieldValue(
      getDb(),
      mockFieldValue
    )

    const response = await server.inject({
      headers: {
        authorization: `Bearer ${createSortJwt(caller.id)}`
      },
      method: 'GET',
      url: `/v2/orgs/${org.slug}/databases/${database.slug}/change-requests/${changeRequest.change_request_number}/changes`
    })

    const {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      metadata_database_name: database_name,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      metadata_schema_name: schema_name,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      metadata_table_name: table_name,
      // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars
      connection_id,
      ...chg
    } = createdChange

    if (statusCode === 200) {
      expect(response.json()).toEqual({
        type: 'list_changes',
        payload: {
          changes: [
            {
              ...chg,
              database_name,
              schema_name,
              table_name,
              fields: [
                {
                  column_name: createdFieldValue.column_name,
                  type: 'string',
                  value: createdFieldValue.string_value
                }
              ]
            }
          ]
        }
      })
    } else if (statusCode === 404) {
      expectNotFound(response, 'database')
    }

    expect(response.statusCode).toBe(statusCode)
  }

  const createMockChange = async (
    changeRequestId: string,
    connectionId: string,
    databaseRawName: string,
    schemaRawName: string,
    tableRawName: string,
    action: 'ADD' | 'MODIFY' | 'DELETE'
  ) => {
    const keys: ChangePrimaryKeyInsert[] = []
    const fields: ChangeFieldValueInsert[] = []

    const payload = {
      index: 0,
      database_name: databaseRawName,
      schema_name: schemaRawName,
      table_name: tableRawName
    }

    const mockChange = changeMock.create({
      change_request_id: changeRequestId,
      action,
      connection_id: connectionId,
      index: payload.index,
      metadata_database_name: databaseRawName,
      metadata_schema_name: schemaRawName,
      metadata_table_name: tableRawName
    })

    const createdChange = await ChangeService.insertChange(getDb(), mockChange)
    const id = randomUUID()

    if (action === 'ADD' || action === 'MODIFY') {
      const mockFieldValue = changeMock.createFieldValue({
        change_id: mockChange.id,
        column_name: 'id',
        uuid_value: id,
        string_value: undefined
      })

      const createdFieldValue = await ChangeService.insertChangeFieldValue(
        getDb(),
        mockFieldValue
      )

      fields.push(createdFieldValue)
    }

    if (action === 'MODIFY' || action === 'DELETE') {
      const mockPrimaryKey = changeMock.createPrimaryKey({
        change_id: mockChange.id,
        column_name: 'id',
        uuid_value: id,
        string_value: undefined
      })

      const createdPrimaryKey = await ChangeService.insertChangePrimaryKey(
        getDb(),
        mockPrimaryKey
      )

      keys.push(createdPrimaryKey)
    }

    return {
      change: createdChange,
      fields,
      keys
    }
  }

  const testUpdateChange = async ({
    creator,
    caller,
    connection,
    database,
    statusCode,
    action,
    submitPrimaryKeys = true,
    submitFields = true
  }: {
    creator: User
    caller: User
    connection: ConnectionType.ConnectionSelectWithEncryption
    database: MetadataDatabase
    statusCode: number
    action: SubjectAction
    submitPrimaryKeys?: boolean
    submitFields?: boolean
  }) => {
    const addChangeRequestHistorySpy = jest.spyOn(
      ChangeRequestService,
      'addChangeRequestHistory'
    )

    const changeRequest = await createMockChangeRequest(
      creator,
      connection.visibility
    )

    // create a change we're going to modify/delete, we pass
    // a subject action that will be the type of change
    // that we are trying to add, modify or delete
    const createdChange = await createMockChange(
      changeRequest.id,
      connection.id,
      database.raw_name,
      'test',
      'change_request_test',
      action
    )
    const testRecordId = createdChange.keys[0]?.uuid_value ?? randomUUID()

    const fieldPayload1 = {
      column_name: 'id',
      value: randomUUID()
    }
    const fieldPayload2 = {
      column_name: 'test_text',
      value: 'test_text_value'
    }
    const primaryKeyPayload = {
      column_name: 'id',
      value: testRecordId
    }

    const originalTestText = 'some_other_value'
    const testRec = testTableMock.create({
      id: testRecordId,
      test_text: originalTestText
    })
    await testTableMock.insert(testRec)

    const payload = {
      fields: submitFields
        ? action === 'DELETE'
          ? []
          : [fieldPayload1, fieldPayload2]
        : undefined,
      primary_keys: submitPrimaryKeys
        ? action === 'ADD'
          ? []
          : [primaryKeyPayload]
        : undefined
    } satisfies RequestUpdateChange

    const response = await server.inject({
      headers: {
        authorization: `Bearer ${createSortJwt(caller.id)}`
      },
      method: 'PATCH',
      url: `/v2/orgs/${org.slug}/databases/${database.slug}/change-requests/${changeRequest.change_request_number}/changes/${createdChange.change.id}`,
      payload
    })

    if (statusCode === 200) {
      const previousFields = [
        {
          column_name: 'id',
          value: testRecordId,
          type: 'uuid'
        },
        {
          column_name: 'test_text',
          value: originalTestText,
          type: 'string'
        }
      ]

      const expectedPrimaryKeys = [
        {
          ...primaryKeyPayload,
          type: 'uuid'
        }
      ]

      const expectedFields = submitFields
        ? [
            {
              ...fieldPayload1,
              type: expect.any(String)
            },
            {
              ...fieldPayload2,
              type: expect.any(String)
            }
          ]
        : [
            {
              column_name: createdChange.fields[0].column_name,
              value: createdChange.fields[0].uuid_value!,
              type: 'uuid'
            }
          ]

      const {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        metadata_database_name: database_name,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        metadata_schema_name: schema_name,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        metadata_table_name: table_name,
        // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars
        connection_id,
        ...chg
      } = createdChange.change

      const json = response.json()
      expect(json).toEqual({
        type: 'update_change',
        payload: {
          change: {
            ...chg,
            database_name,
            schema_name,
            table_name,
            fields:
              action === 'DELETE'
                ? expect.arrayContaining([])
                : expect.arrayContaining(expectedFields),
            previous_fields:
              action === 'ADD'
                ? expect.arrayContaining([])
                : expect.arrayContaining(previousFields),
            primary_keys:
              action === 'ADD'
                ? expect.arrayContaining([])
                : expect.arrayContaining(expectedPrimaryKeys)
          }
        }
      })

      if (action !== 'ADD') {
        expect(json.payload.change.previous_fields).toHaveLength(
          previousFields.length
        )
      }

      expect(addChangeRequestHistorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          history: expect.objectContaining({
            action_type: 'UPDATE_CHANGE'
          })
        }),
        {}
      )
    } else if (statusCode === 404) {
      expectNotFound(response, 'database')
    }

    expect(response.statusCode).toBe(statusCode)
  }

  const testDeleteChange = async (
    creator: User,
    caller: User,
    connection: ConnectionType.ConnectionSelectWithEncryption,
    database: MetadataDatabase,
    statusCode: number,
    action: SubjectAction
  ) => {
    const addChangeRequestHistorySpy = jest.spyOn(
      ChangeRequestService,
      'addChangeRequestHistory'
    )

    const changeRequest = await createMockChangeRequest(
      creator,
      connection.visibility
    )

    // create a change we're going to modify/delete, we pass
    // a subject action that will be the type of change
    // that we are trying to add, modify or delete
    const change = await createMockChange(
      changeRequest.id,
      connection.id,
      database.raw_name,
      'test',
      'change_request_test',
      action
    )

    const commentPayload = changeRequestCommentMock.createPayload({
      content: 'Change Comment Content',
      change_id: change.change.id
    })

    if (statusCode === 200) {
      const commentResponse = await server.inject({
        headers: {
          authorization: `Bearer ${createSortJwt(caller.id)}`
        },
        method: 'POST',
        url: `/v2/orgs/${org.slug}/databases/${database.slug}/change-requests/${changeRequest.change_request_number}/comments`,
        payload: commentPayload
      })
      expect(commentResponse.statusCode).toBe(201)
      changeRequestCommentMock.addPayloadId(
        commentResponse.json().payload.change_request_comment.id
      )
    }

    const response = await server.inject({
      headers: {
        authorization: `Bearer ${createSortJwt(caller.id)}`
      },
      method: 'DELETE',
      url: `/v2/orgs/${org.slug}/databases/${database.slug}/change-requests/${changeRequest.change_request_number}/changes/${change.change.id}`
    })

    if (statusCode === 200) {
      expect(addChangeRequestHistorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          history: expect.objectContaining({
            action_type: 'DELETE_CHANGE'
          })
        }),
        {}
      )

      expect(response.json()).toEqual({
        type: 'success',
        payload: {
          success: {
            message: `Change ${change.change.id} deleted successfully.`
          }
        }
      })
    } else if (statusCode === 404) {
      expectNotFound(response, 'database')
    }

    expect(response.statusCode).toBe(statusCode)
  }

  const testCreateChanges = async (
    creator: User,
    caller: User,
    connection: ConnectionType.ConnectionSelectWithEncryption,
    database: MetadataDatabase,
    statusCode: number,
    action: SubjectAction
  ) => {
    const addChangeRequestHistorySpy = jest.spyOn(
      ChangeRequestService,
      'addChangeRequestHistory'
    )
    addChangeRequestHistorySpy.mockClear()

    const changeRequest = await createMockChangeRequest(
      creator,
      connection.visibility
    )

    const testRecordId = randomUUID()

    const testRec = testTableMock.create({
      id: testRecordId,
      test_text: 'some_other_value'
    })
    await testTableMock.insert(testRec)

    const fieldPayload0 = [
      {
        column_name: 'test_text',
        value: 'test_text_value'
      },
      {
        column_name: 'id',
        value: randomUUID()
      }
    ]
    const fieldPayload1 = [
      {
        column_name: 'id',
        value: randomUUID()
      }
    ]
    const primaryKeyPayload = {
      column_name: 'id',
      value: testRecordId
    }
    const payload = [
      {
        action,
        schema_name: 'test',
        table_name: 'change_request_test',
        fields: fieldPayload0,
        primary_keys: [primaryKeyPayload]
      },
      {
        action,
        schema_name: 'test',
        table_name: 'change_request_test',
        fields: fieldPayload1,
        primary_keys: [primaryKeyPayload]
      }
    ] satisfies RequestChange[]

    const response = await server.inject({
      headers: {
        authorization: `Bearer ${createSortJwt(caller.id)}`
      },
      method: 'POST',
      url: `/v2/orgs/${org.slug}/databases/${database.slug}/change-requests/${changeRequest.change_request_number}/changes/batch`,
      payload
    })

    if (statusCode === 201) {
      expect(addChangeRequestHistorySpy).toHaveBeenCalledTimes(2)
      expect(addChangeRequestHistorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          history: expect.objectContaining({
            action_type: 'ADD_CHANGE'
          })
        }),
        {}
      )

      const previousFields0 = [
        {
          column_name: 'id',
          type: 'uuid',
          value: testRecordId
        },
        {
          column_name: 'test_text',
          type: 'string',
          value: expect.any(String)
        }
      ]

      const previousFields1 = [
        {
          column_name: 'id',
          type: 'uuid',
          value: testRecordId
        }
      ]

      const body = response.json()
      expect(body).toEqual({
        type: 'create_changes',
        payload: {
          changes: expect.arrayContaining([
            {
              ...payload[0],
              index: 0,
              change_request_id: changeRequest.id,
              database_name: database.raw_name,
              id: expect.any(String),
              previous_fields:
                action === 'ADD'
                  ? expect.arrayContaining([])
                  : expect.arrayContaining(previousFields0),
              primary_keys:
                action === 'ADD'
                  ? expect.arrayContaining([])
                  : expect.arrayContaining([
                      {
                        ...primaryKeyPayload,
                        type: expect.any(String)
                      }
                    ]),
              fields:
                action !== 'DELETE'
                  ? fieldPayload0.map(n => ({
                      ...n,
                      type: expect.any(String)
                    }))
                  : undefined
            },
            {
              ...payload[1],
              index: 1,
              change_request_id: changeRequest.id,
              database_name: database.raw_name,
              id: expect.any(String),
              previous_fields:
                action === 'ADD'
                  ? expect.arrayContaining([])
                  : expect.arrayContaining(previousFields1),
              primary_keys:
                action === 'ADD'
                  ? expect.arrayContaining([])
                  : expect.arrayContaining([
                      {
                        ...primaryKeyPayload,
                        type: expect.any(String)
                      }
                    ]),
              fields:
                action !== 'DELETE'
                  ? fieldPayload1.map(n => ({
                      ...n,
                      type: expect.any(String)
                    }))
                  : undefined
            }
          ])
        }
      })
    } else if (statusCode === 404) {
      expectNotFound(response, 'database')
    }

    expect(response.statusCode).toBe(statusCode)
  }

  describe('list_changes operation', () => {
    paramsTester.testInvalidParams({
      method: 'GET',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/changes',
      userId: orgAdminUser.id
    })

    testInvalidSortAuthHeaders({
      method: 'GET',
      url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/123/changes`
    })

    paramsTester.testNotFound({
      method: 'GET',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/changes',
      userId: orgAdminUser.id
    })

    it('should respond with 500 when a service error occurs', async () => {
      const changeRequest = await createMockChangeRequest(
        orgAdminUser,
        'private'
      )

      jest
        .spyOn(ChangeService, 'getFullChangesResponse')
        .mockRejectedValueOnce(new Error('fake error'))

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'GET',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${changeRequest.change_request_number}/changes`
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

    describe('for Public Connections', () => {
      describe('when the caller is an Org Owner', () => {
        it('should respond with 200 and return all changes', async () => {
          await testGetChanges(
            orgAdminUser,
            orgAdminUser,
            pubConn,
            pubDbEntry,
            200
          )
        })
      })

      describe('when the caller is an Org Member', () => {
        it('should respond with 200 and return all changes', async () => {
          await testGetChanges(
            orgMemberUser1,
            orgMemberUser1,
            pubConn,
            pubDbEntry,
            200
          )
        })
      })

      describe('when the caller is a Non-Org Member', () => {
        it('should respond with 200 and return all changes', async () => {
          await testGetChanges(
            orgMemberUser1,
            nonOrgUser1,
            pubConn,
            pubDbEntry,
            200
          )
        })
      })

      describe('when the caller is not logged in', () => {
        it('should respond with 200 and return all changes', async () => {
          await testGetChanges(
            orgMemberUser1,
            sorthubSvcAccount,
            pubConn,
            pubDbEntry,
            200
          )
        })
      })
    })

    describe('for Private Connections', () => {
      describe('when the caller is an Org Owner', () => {
        it('should respond with 200 and return all changes', async () => {
          await testGetChanges(
            orgAdminUser,
            orgAdminUser,
            prvConn,
            prvDbEntry,
            200
          )
        })
      })

      describe('when the caller is an Org Member', () => {
        it('should respond with 200 and return all changes', async () => {
          await testGetChanges(
            orgMemberUser1,
            orgMemberUser1,
            prvConn,
            prvDbEntry,
            200
          )
        })
      })

      describe('when the caller is a Non-Org Member', () => {
        it('should respond with 404 and not return any changes', async () => {
          await testGetChanges(
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

  describe('update_change operation', () => {
    beforeEach(async () => {
      await createMockChangeRequest(orgAdminUser, 'private')
    })

    testInvalidStatus('PATCH', {
      action: 'MODIFY',
      fields: [],
      table_name: 'change_request_test',
      schema_name: 'test'
    })

    paramsTester.testInvalidParams({
      method: 'PATCH',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/changes/:change_id',
      userId: orgAdminUser.id
    })

    testInvalidSortAuthHeaders({
      method: 'PATCH',
      url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/123/changes/1`
    })

    paramsTester.testNotFound({
      method: 'PATCH',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/changes/:change_id',
      userId: orgAdminUser.id,
      defaultPayload
    })

    it('should respond with 500 when a service error occurs', async () => {
      const changeRequest = await createMockChangeRequest(
        orgAdminUser,
        'private'
      )

      const createdChange = await createMockChange(
        changeRequest.id,
        prvConn.id,
        prvDbEntry.raw_name,
        'test',
        'change_request_test',
        'MODIFY'
      )

      jest
        .spyOn(UpdateChangeService, 'updateChangeInChangeRequest')
        .mockRejectedValueOnce(new Error('fake error'))

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'PATCH',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${changeRequest.change_request_number}/changes/${createdChange.change.id}`,
        body: defaultPayload
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

    it('responds with 409 when column is not nullable and not generated', async () => {
      const changeRequest = await createMockChangeRequest(
        orgAdminUser,
        'private'
      )

      const createdChange = await createMockChange(
        changeRequest.id,
        prvConn.id,
        prvDbEntry.raw_name,
        'test',
        'change_request_test',
        'ADD'
      )
      const testRecordId = createdChange.keys[0]?.uuid_value ?? randomUUID()

      const testRec = testTableMock.create({
        id: testRecordId,
        test_text: 'some_other_value'
      })
      await testTableMock.insert(testRec)

      const payload = {
        action: 'ADD',
        fields: [
          {
            column_name: 'test_text',
            value: 'waz up'
          }
        ],
        table_name: 'change_request_test',
        schema_name: 'test'
      } satisfies RequestChange

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'PATCH',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${changeRequest.change_request_number}/changes/${createdChange.change.id}`,
        payload
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

    describe('for Public Connections', () => {
      describe('when the caller is an Org Owner', () => {
        it('should respond with 200', async () => {
          for (const action of ['ADD', 'MODIFY', 'DELETE'] as const) {
            await testUpdateChange({
              creator: orgAdminUser,
              caller: orgAdminUser,
              connection: pubConn,
              database: pubDbEntry,
              statusCode: 200,
              action
            })
          }
        })
      })

      describe('when the caller is an Org Member', () => {
        it('should respond with 200', async () => {
          for (const action of ['ADD', 'MODIFY', 'DELETE'] as const) {
            await testUpdateChange({
              creator: orgMemberUser1,
              caller: orgMemberUser1,
              connection: pubConn,
              database: pubDbEntry,
              statusCode: 200,
              action
            })
          }
        })

        describe('when the same change is modified twice', () => {
          it('does not duplicate previous_fields', async () => {
            const creator = orgMemberUser1
            const caller = orgMemberUser1
            const connection = pubConn
            const database = pubDbEntry
            const action = 'MODIFY'

            const changeRequest = await createMockChangeRequest(
              creator,
              connection.visibility
            )

            const createdChange = await createMockChange(
              changeRequest.id,
              connection.id,
              database.raw_name,
              'test',
              'change_request_test',
              action
            )

            const originalTestText = 'original value'
            const testRecordId =
              createdChange.keys[0]?.uuid_value ?? randomUUID()

            const testRec = testTableMock.create({
              id: testRecordId,
              test_text: originalTestText
            })
            await testTableMock.insert(testRec)

            const testUpdate = async (
              payload: RequestUpdateChange,
              previousFields: {
                column_name: string
                value: string
                type: string
              }[]
            ) => {
              const response = await server.inject({
                headers: {
                  authorization: `Bearer ${createSortJwt(caller.id)}`
                },
                method: 'PATCH',
                url: `/v2/orgs/${org.slug}/databases/${database.slug}/change-requests/${changeRequest.change_request_number}/changes/${createdChange.change.id}`,
                payload
              })

              const fields =
                payload.fields?.map(field => {
                  return {
                    ...field,
                    type: expect.any(String)
                  }
                }) ?? []

              const primaryKeys =
                payload.primary_keys?.map(key => {
                  return {
                    ...key,
                    type: 'uuid'
                  }
                }) ?? []

              const {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                metadata_database_name: database_name,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                metadata_schema_name: schema_name,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                metadata_table_name: table_name,
                // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars
                connection_id,
                ...chg
              } = createdChange.change

              const json = response.json()
              expect(json).toEqual({
                type: 'update_change',
                payload: {
                  change: {
                    ...chg,
                    database_name,
                    schema_name,
                    table_name,
                    fields: expect.arrayContaining(fields),
                    previous_fields: expect.arrayContaining(previousFields),
                    primary_keys: expect.arrayContaining(primaryKeys)
                  }
                }
              })

              expect(json.payload.change.previous_fields).toHaveLength(
                previousFields.length
              )

              expect(response.statusCode).toBe(200)

              return json
            }

            const fieldPayload1 = {
              column_name: 'id',
              value: randomUUID()
            }
            const fieldPayload2 = {
              column_name: 'test_text',
              value: '2nd value'
            }
            const primaryKeyPayload = {
              column_name: 'id',
              value: testRecordId
            }
            const payload1 = {
              fields: [fieldPayload1, fieldPayload2],
              primary_keys: [primaryKeyPayload]
            }

            const json = await testUpdate(payload1, [
              {
                column_name: 'id',
                value: testRecordId,
                type: 'uuid'
              },
              {
                column_name: 'test_text',
                value: originalTestText,
                type: 'string'
              }
            ])

            const payload2 = {
              fields: [
                { column_name: 'id', value: randomUUID() },
                { column_name: 'test_text', value: '3rd value' }
              ],
              primary_keys: json.payload.change.primary_keys
            }
            await testUpdate(payload2, json.payload.change.previous_fields)
          })
        })
      })

      describe('when the caller is the author but Non-Org Member', () => {
        it('should respond with 200', async () => {
          for (const action of ['ADD', 'MODIFY', 'DELETE'] as const) {
            await testUpdateChange({
              creator: nonOrgUser1,
              caller: nonOrgUser1,
              connection: pubConn,
              database: pubDbEntry,
              statusCode: 200,
              action
            })
          }
        })
      })

      describe('when the caller is a Non-Org Member and modifying an org members change', () => {
        it('should respond with 403', async () => {
          for (const action of ['ADD', 'MODIFY', 'DELETE'] as const) {
            await testUpdateChange({
              creator: orgMemberUser1,
              caller: nonOrgUser1,
              connection: pubConn,
              database: pubDbEntry,
              statusCode: 403,
              action
            })
          }
        })
      })
    })

    describe('for Private Connections', () => {
      describe('when the caller is an Org Owner', () => {
        it('should respond with 200 and return all changes', async () => {
          for (const action of ['ADD', 'MODIFY', 'DELETE'] as const) {
            await testUpdateChange({
              creator: orgAdminUser,
              caller: orgAdminUser,
              connection: prvConn,
              database: prvDbEntry,
              statusCode: 200,
              action
            })
          }
        })
      })

      describe('when the caller is an Org Member', () => {
        it('should respond with 200 and return all changes', async () => {
          for (const action of ['ADD', 'MODIFY', 'DELETE'] as const) {
            await testUpdateChange({
              creator: orgMemberUser1,
              caller: orgMemberUser1,
              connection: prvConn,
              database: prvDbEntry,
              statusCode: 200,
              action
            })
          }
        })

        describe('when no primary keys are passed', () => {
          it('updates fields and responds with 200', async () => {
            await testUpdateChange({
              creator: orgMemberUser1,
              caller: orgMemberUser1,
              connection: prvConn,
              database: prvDbEntry,
              statusCode: 200,
              action: 'MODIFY',
              submitPrimaryKeys: false
            })
          })
        })

        describe('when no fields are passed', () => {
          it('updates keys and responds with 200', async () => {
            await testUpdateChange({
              creator: orgMemberUser1,
              caller: orgMemberUser1,
              connection: prvConn,
              database: prvDbEntry,
              statusCode: 200,
              action: 'MODIFY',
              submitFields: false
            })
          })
        })

        describe('when the submitted primary key does not exist in the customer db', () => {
          it('responds with 409', async () => {
            const changeRequest = await createMockChangeRequest(
              orgAdminUser,
              'private'
            )

            const createdChange = await createMockChange(
              changeRequest.id,
              prvConn.id,
              prvDbEntry.raw_name,
              'test',
              'change_request_test',
              'MODIFY'
            )
            const testRecordId =
              createdChange.keys[0]?.uuid_value ?? randomUUID()

            const testRec = testTableMock.create({
              id: testRecordId,
              test_text: 'some_other_value'
            })
            await testTableMock.insert(testRec)

            const payload = {
              primary_keys: [{ column_name: 'id', value: randomUUID() }]
            } satisfies RequestUpdateChange

            const response = await server.inject({
              headers: {
                authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
              },
              method: 'PATCH',
              url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${changeRequest.change_request_number}/changes/${createdChange.change.id}`,
              body: payload
            })

            const msg =
              /Row not found. The row you are trying to change does not exist in your database. Table: .+, Primary Key: (.+)$/
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
      })

      describe('when the caller is a Non-Org Member', () => {
        it('should respond with 404 and not return any changes', async () => {
          for (const action of ['ADD', 'MODIFY', 'DELETE'] as const) {
            await testUpdateChange({
              creator: nonOrgUser1,
              caller: nonOrgUser1,
              connection: prvConn,
              database: prvDbEntry,
              statusCode: 404,
              action
            })
          }
        })
      })
    })
  })

  describe('create_changes operation', () => {
    const defaultCreatePayload = [
      {
        action: 'ADD',
        schema_name: 'test',
        table_name: 'change_request_test',
        fields: [
          {
            column_name: 'test_text',
            value: 'test_text_value'
          }
        ]
      }
    ] as RequestChange[]

    beforeEach(async () => {
      await createMockChangeRequest(orgAdminUser, 'private')
    })

    testInvalidStatus('POST', defaultCreatePayload, true)

    paramsTester.testInvalidParams({
      method: 'POST',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/changes/batch',
      userId: orgAdminUser.id
    })

    testInvalidSortAuthHeaders({
      method: 'POST',
      url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/123/changes/batch`
    })

    paramsTester.testNotFound({
      method: 'POST',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/changes/batch',
      userId: orgAdminUser.id,
      defaultPayload: defaultCreatePayload
    })

    it('should respond with 500 when a service error occurs', async () => {
      const changeRequest = await createMockChangeRequest(
        orgAdminUser,
        'private'
      )

      jest
        .spyOn(UpdateChangeService, 'createChangesInChangeRequest')
        .mockRejectedValueOnce(new Error('fake error'))

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${changeRequest.change_request_number}/changes/batch`,
        body: defaultCreatePayload
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

    it('responds with 400 when column is not nullable', async () => {
      const changeRequest = await createMockChangeRequest(
        orgAdminUser,
        'private'
      )

      const payload = [
        {
          action: 'ADD',
          fields: [
            {
              column_name: 'id',
              value: null
            }
          ],
          table_name: 'change_request_test_no_primary_keys',
          schema_name: 'test'
        }
      ] satisfies RequestChange[]

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        payload,
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${changeRequest.change_request_number}/changes/batch`
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
                '0/fields/0/value': message
              }
            }
          }
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('responds with 409 when column is not nullable and not generated', async () => {
      const changeRequest = await createMockChangeRequest(
        orgAdminUser,
        'private'
      )

      const payload = [
        {
          action: 'ADD',
          fields: [
            {
              column_name: 'test_text',
              value: 'waz up'
            }
          ],
          table_name: 'change_request_test',
          schema_name: 'test'
        }
      ] satisfies RequestChange[]

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        payload,
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${changeRequest.change_request_number}/changes/batch`
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

    describe('when a submitted primary key does not exist in the customer db', () => {
      it('responds with 409', async () => {
        const changeRequest = await createMockChangeRequest(
          orgAdminUser,
          prvConn.visibility
        )

        await testTableMock.insert(
          testTableMock.create({
            id: randomUUID(),
            test_text: 'hello-409-1'
          })
        )

        const fieldPayload = [
          {
            column_name: 'test_text',
            value: 'test_text_value'
          }
        ]

        const primaryKeyPayload = {
          column_name: 'id',
          value: randomUUID()
        }

        const payload = [
          {
            action: 'MODIFY',
            schema_name: 'test',
            table_name: 'change_request_test',
            fields: fieldPayload,
            primary_keys: [primaryKeyPayload]
          }
        ] satisfies RequestChange[]

        const response = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'POST',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${changeRequest.change_request_number}/changes/batch`,
          payload
        })

        const msg =
          /Row not found. The row you are trying to change does not exist in your database. Table: .+, Primary Key: (.+)$/
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

    describe('when a submitted table name does not exist in the customer db', () => {
      it('responds with 409', async () => {
        const changeRequest = await createMockChangeRequest(
          orgAdminUser,
          prvConn.visibility
        )

        const fieldPayload = [
          {
            column_name: 'test_text',
            value: 'test_text_value'
          }
        ]

        const primaryKeyPayload = {
          column_name: 'id',
          value: randomUUID()
        }

        const payload = [
          {
            action: 'MODIFY',
            schema_name: 'test',
            table_name: 'non_existent_table',
            fields: fieldPayload,
            primary_keys: [primaryKeyPayload]
          }
        ] satisfies RequestChange[]

        const response = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'POST',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${changeRequest.change_request_number}/changes/batch`,
          payload
        })

        const msg =
          'Table "non_existent_table" does not exist in the database. Please double check your table names and/or re-import your database before trying again.'
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
        it('should respond with 201', async () => {
          for (const action of ['ADD', 'MODIFY', 'DELETE'] as const) {
            await testCreateChanges(
              orgAdminUser,
              orgAdminUser,
              pubConn,
              pubDbEntry,
              201,
              action
            )
          }
        })
      })

      describe('when the caller is an Org Member', () => {
        it('should respond with 201', async () => {
          for (const action of ['ADD', 'MODIFY', 'DELETE'] as const) {
            await testCreateChanges(
              orgMemberUser1,
              orgMemberUser1,
              pubConn,
              pubDbEntry,
              201,
              action
            )
          }
        })
      })

      describe('when the caller is a Non-Org Member', () => {
        it('should respond with 201', async () => {
          for (const action of ['ADD', 'MODIFY', 'DELETE'] as const) {
            await testCreateChanges(
              nonOrgUser1,
              nonOrgUser1,
              pubConn,
              pubDbEntry,
              201,
              action
            )
          }
        })
      })

      describe('when the caller is a Non-Org Member and modifying an org members change', () => {
        it('should respond with 403', async () => {
          for (const action of ['ADD', 'MODIFY', 'DELETE'] as const) {
            await testCreateChanges(
              orgMemberUser1,
              nonOrgUser1,
              pubConn,
              pubDbEntry,
              403,
              action
            )
          }
        })
      })
    })

    describe('for Private Connections', () => {
      describe('when the caller is an Org Owner', () => {
        it('should respond with 201 and return all changes', async () => {
          for (const action of ['ADD', 'MODIFY', 'DELETE'] as const) {
            await testCreateChanges(
              orgAdminUser,
              orgAdminUser,
              prvConn,
              prvDbEntry,
              201,
              action
            )
          }
        })
      })

      describe('when the caller is an Org Member', () => {
        it('should respond with 201 and return all changes', async () => {
          for (const action of ['ADD', 'MODIFY', 'DELETE'] as const) {
            await testCreateChanges(
              orgMemberUser1,
              orgMemberUser1,
              prvConn,
              prvDbEntry,
              201,
              action
            )
          }
        })
      })

      describe('when the caller is a Non-Org Member', () => {
        it('should respond with 404 and not return any changes', async () => {
          for (const action of ['ADD', 'MODIFY', 'DELETE'] as const) {
            await testCreateChanges(
              nonOrgUser1,
              nonOrgUser1,
              prvConn,
              prvDbEntry,
              404,
              action
            )
          }
        })
      })
    })
  })

  describe('delete_change operation', () => {
    beforeEach(async () => {
      await createMockChangeRequest(orgAdminUser, 'private')
    })

    testInvalidStatus('DELETE')

    paramsTester.testInvalidParams({
      method: 'DELETE',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/changes/:change_id',
      userId: orgAdminUser.id
    })

    testInvalidSortAuthHeaders({
      method: 'DELETE',
      url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/123/changes/1`
    })

    paramsTester.testNotFound({
      method: 'DELETE',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/changes/:change_id',
      userId: orgAdminUser.id
    })

    it('should respond with 500 when a service error occurs', async () => {
      const changeRequest = await createMockChangeRequest(
        orgAdminUser,
        'private'
      )

      const createdChange = await createMockChange(
        changeRequest.id,
        prvConn.id,
        prvDbEntry.raw_name,
        'test',
        'change_request_test',
        'ADD'
      )

      jest
        .spyOn(ChangeService, 'deleteChange')
        .mockRejectedValueOnce(new Error('fake error'))

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'DELETE',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${changeRequest.change_request_number}/changes/${createdChange.change.id}`
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

    describe('for Public Connections', () => {
      describe('when the caller is an Org Owner', () => {
        it('should respond with 200', async () => {
          for (const action of ['ADD', 'MODIFY', 'DELETE'] as const) {
            await testDeleteChange(
              orgAdminUser,
              orgAdminUser,
              pubConn,
              pubDbEntry,
              200,
              action
            )
          }
        })
      })

      describe('when the caller is an Org Member', () => {
        it('should respond with 200', async () => {
          for (const action of ['ADD', 'MODIFY', 'DELETE'] as const) {
            await testDeleteChange(
              orgMemberUser1,
              orgMemberUser1,
              pubConn,
              pubDbEntry,
              200,
              action
            )
          }
        })
      })

      describe('when the caller is a Non-Org Member', () => {
        it('should respond with 200', async () => {
          for (const action of ['ADD', 'MODIFY', 'DELETE'] as const) {
            await testDeleteChange(
              nonOrgUser1,
              nonOrgUser1,
              pubConn,
              pubDbEntry,
              200,
              action
            )
          }
        })
      })

      describe('when the caller is a Non-Org Member and modifying an org members change', () => {
        it('should respond with 403', async () => {
          for (const action of ['ADD', 'MODIFY', 'DELETE'] as const) {
            await testDeleteChange(
              orgMemberUser1,
              nonOrgUser1,
              pubConn,
              pubDbEntry,
              403,
              action
            )
          }
        })
      })
    })

    describe('for Private Connections', () => {
      describe('when the caller is an Org Owner', () => {
        it('should respond with 200 and return all changes', async () => {
          for (const action of ['ADD', 'MODIFY', 'DELETE'] as const) {
            await testDeleteChange(
              orgAdminUser,
              orgAdminUser,
              prvConn,
              prvDbEntry,
              200,
              action
            )
          }
        })
      })

      describe('when the caller is an Org Member', () => {
        it('should respond with 200 and return all changes', async () => {
          for (const action of ['ADD', 'MODIFY', 'DELETE'] as const) {
            await testDeleteChange(
              orgMemberUser1,
              orgMemberUser1,
              prvConn,
              prvDbEntry,
              200,
              action
            )
          }
        })
      })

      describe('when the caller is a Non-Org Member', () => {
        it('should respond with 404 and not return any changes', async () => {
          for (const action of ['ADD', 'MODIFY', 'DELETE'] as const) {
            await testDeleteChange(
              nonOrgUser1,
              nonOrgUser1,
              prvConn,
              prvDbEntry,
              404,
              action
            )
          }
        })
      })
    })
  })
})
