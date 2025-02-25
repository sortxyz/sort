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
import * as ConnectionService from '@sort/shared/services/connection.service'
import * as MetadataDatabaseService from '@sort/shared/services/kysely/metadata/database.service'
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

import type { RequestChange } from '@sort/shared/schemas/change.schema'
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
    const snapshotColumnMock3 = snapshotMock.ColumnMock.create({
      table_id: snapshotTableMock1.id,
      name: 'test_timestamp',
      type: 'timestamp',
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
    await snapshotMock.ColumnMock.insert(snapshotColumnMock3)
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
    visibility: 'public' | 'private',
    changes?: RequestChange[]
  ) => {
    const connection = visibility === 'public' ? pubConn : prvConn
    const database = visibility === 'public' ? pubDbEntry : prvDbEntry

    const mockChangeRequest = changeRequestMock.create({
      created_by: creator.id,
      connection_id: connection.id,
      database_name: database.raw_name,
      changes
    })

    return await ChangeRequestService.createChangeRequest(mockChangeRequest)
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

  const testUndoCreateChangeRequest = async (
    creator: User,
    caller: User,
    connection: ConnectionType.ConnectionSelectWithEncryption,
    database: MetadataDatabase,
    statusCode: number,
    action: SubjectAction
  ) => {
    switch (action) {
      case 'ADD':
        return testUndoAddChangeRequest(
          creator,
          caller,
          connection,
          database,
          statusCode
        )
      case 'MODIFY':
        return testUndoModifyChangeRequest(
          creator,
          caller,
          connection,
          database,
          statusCode
        )
        break
      case 'DELETE':
        return testUndoDeleteChangeRequest(
          creator,
          caller,
          connection,
          database,
          statusCode
        )
      default:
        throw new Error('Invalid action')
    }
  }

  const testUndoDeleteChangeRequest = async (
    creator: User,
    caller: User,
    connection: ConnectionType.ConnectionSelectWithEncryption,
    database: MetadataDatabase,
    statusCode: number
  ) => {
    const testRecordId = randomUUID()
    const testRecContents = {
      id: testRecordId,
      test_text: 'original_text_value'
    }
    const testRec = testTableMock.create(testRecContents)
    await testTableMock.insert(testRec)

    const primaryKeyPayload = {
      column_name: 'id',
      value: testRecordId
    }
    const changes = [
      {
        action: 'DELETE',
        schema_name: 'test',
        table_name: 'change_request_test',
        primary_keys: [primaryKeyPayload]
      }
    ] satisfies RequestChange[]

    const changeRequest = await createMockChangeRequest(
      creator,
      connection.visibility,
      changes
    )

    await getDb()
      .updateTable('change_request')
      .set({
        status: 'applied'
      })
      .where('id', '=', changeRequest.id)
      .execute()

    await testTableMock.remove(testRecordId)

    const response = await server.inject({
      headers: {
        authorization: `Bearer ${createSortJwt(caller.id)}`
      },
      method: 'POST',
      url: `/v2/orgs/${org.slug}/databases/${database.slug}/change-requests/${changeRequest.change_request_number}/undo`
    })

    if (statusCode === 201) {
      const body = response.json()
      expect(body).toEqual({
        type: 'create_undo_change_request',
        payload: {
          change_request: {
            change_request_number: expect.any(Number),
            created_by: expect.any(String),
            created_at: expect.any(String),
            updated_at: expect.any(String),
            id: expect.any(String),
            database_name: database.raw_name,
            connection_id: connection.id,
            status: 'open',
            description: `Revert changes made in change request ${changeRequest.change_request_number}`,
            title: `Revert "${changeRequest.title}"`,
            labels: [],
            related_issues: [],
            reviewers: [],
            changes: [
              {
                action: 'ADD',
                schema_name: 'test',
                table_name: 'change_request_test',
                database_name: database.raw_name,
                id: expect.any(String),
                change_request_id: expect.any(String),
                index: 0,
                fields: expect.arrayContaining([
                  expect.objectContaining({
                    type: 'uuid',
                    ...primaryKeyPayload
                  }),
                  expect.objectContaining({
                    type: 'string',
                    column_name: 'test_text',
                    value: testRecContents.test_text
                  })
                ])
              }
            ]
          }
        }
      })
    } else if (statusCode === 404) {
      expectNotFound(response, 'database')
    }

    expect(response.statusCode).toBe(statusCode)
  }

  const testUndoModifyChangeRequest = async (
    creator: User,
    caller: User,
    connection: ConnectionType.ConnectionSelectWithEncryption,
    database: MetadataDatabase,
    statusCode: number
  ) => {
    const oldDate = new Date()
    const newDate = new Date(oldDate.getTime() + 1000)
    const testRecordId = randomUUID()
    const testRecContents = {
      id: testRecordId,
      test_text: 'original_text_value',
      test_timestamp: oldDate
    }
    const testRec = testTableMock.create(testRecContents)
    await testTableMock.insert(testRec)

    const fieldPayload = [
      {
        column_name: 'test_text',
        value: 'modified_text_value'
      },
      {
        column_name: 'id',
        value: testRecordId
      },
      {
        column_name: 'test_timestamp',
        value: newDate
      }
    ]
    const primaryKeyPayload = fieldPayload[1]
    const changes = [
      {
        action: 'MODIFY',
        schema_name: 'test',
        table_name: 'change_request_test',
        fields: fieldPayload,
        primary_keys: [primaryKeyPayload]
      }
    ] satisfies RequestChange[]

    const changeRequest = await createMockChangeRequest(
      creator,
      connection.visibility,
      changes
    )

    await getDb()
      .updateTable('change_request')
      .set({
        status: 'applied'
      })
      .where('id', '=', changeRequest.id)
      .execute()

    await testTableMock.update(
      {
        test_text: 'modified_text_value',
        test_timestamp: newDate
      },
      testRecordId
    )

    const response = await server.inject({
      headers: {
        authorization: `Bearer ${createSortJwt(caller.id)}`
      },
      method: 'POST',
      url: `/v2/orgs/${org.slug}/databases/${database.slug}/change-requests/${changeRequest.change_request_number}/undo`
    })

    if (statusCode === 201) {
      const body = response.json()
      expect(body).toEqual({
        type: 'create_undo_change_request',
        payload: {
          change_request: {
            change_request_number: expect.any(Number),
            created_by: expect.any(String),
            created_at: expect.any(String),
            updated_at: expect.any(String),
            id: expect.any(String),
            database_name: database.raw_name,
            connection_id: connection.id,
            status: 'open',
            description: `Revert changes made in change request ${changeRequest.change_request_number}`,
            title: `Revert "${changeRequest.title}"`,
            labels: [],
            related_issues: [],
            reviewers: [],
            changes: [
              {
                action: 'MODIFY',
                schema_name: 'test',
                table_name: 'change_request_test',
                database_name: database.raw_name,
                id: expect.any(String),
                change_request_id: expect.any(String),
                index: 0,
                primary_keys: [
                  {
                    type: 'uuid',
                    ...primaryKeyPayload
                  }
                ],
                fields: expect.arrayContaining([
                  expect.objectContaining({
                    type: 'uuid',
                    ...fieldPayload[1]
                  }),
                  expect.objectContaining({
                    type: 'string',
                    ...fieldPayload[0],
                    value: testRecContents.test_text
                  })
                ]),
                previous_fields: expect.arrayContaining([
                  expect.objectContaining({
                    type: 'uuid',
                    ...fieldPayload[1]
                  }),
                  expect.objectContaining({
                    type: 'string',
                    ...fieldPayload[0]
                  })
                ])
              }
            ]
          }
        }
      })
    } else if (statusCode === 404) {
      expectNotFound(response, 'database')
    }

    expect(response.statusCode).toBe(statusCode)
  }

  const testUndoAddChangeRequest = async (
    creator: User,
    caller: User,
    connection: ConnectionType.ConnectionSelectWithEncryption,
    database: MetadataDatabase,
    statusCode: number
  ) => {
    const testRecordId = randomUUID()

    const fieldPayload = [
      {
        column_name: 'test_text',
        value: 'test_text_value'
      },
      {
        column_name: 'id',
        value: testRecordId
      }
    ]
    const primaryKeyPayload = fieldPayload[1]
    const changes = [
      {
        action: 'ADD',
        schema_name: 'test',
        table_name: 'change_request_test',
        fields: fieldPayload
      }
    ] satisfies RequestChange[]

    const changeRequest = await createMockChangeRequest(
      creator,
      connection.visibility,
      changes
    )

    await getDb()
      .updateTable('change_request')
      .set({
        status: 'applied'
      })
      .where('id', '=', changeRequest.id)
      .execute()

    // add our saved "returned" primary keys for the change since we're manually inserting
    await getDb()
      .insertInto('change_previous_primary_key')
      .values({
        id: randomUUID(),
        change_id: changeRequest.changes[0].id,
        column_name: primaryKeyPayload.column_name,
        uuid_value: primaryKeyPayload.value
      })
      .execute()

    // simulate change request application by manual insertion
    const testRecContents = {
      id: testRecordId,
      test_text: 'test_text_value'
    }
    const testRec = testTableMock.create(testRecContents)
    await testTableMock.insert(testRec)

    const response = await server.inject({
      headers: {
        authorization: `Bearer ${createSortJwt(caller.id)}`
      },
      method: 'POST',
      url: `/v2/orgs/${org.slug}/databases/${database.slug}/change-requests/${changeRequest.change_request_number}/undo`
    })

    if (statusCode === 201) {
      const body = response.json()
      expect(body).toEqual({
        type: 'create_undo_change_request',
        payload: {
          change_request: {
            change_request_number: expect.any(Number),
            created_by: expect.any(String),
            created_at: expect.any(String),
            updated_at: expect.any(String),
            id: expect.any(String),
            database_name: database.raw_name,
            connection_id: connection.id,
            status: 'open',
            description: `Revert changes made in change request ${changeRequest.change_request_number}`,
            title: `Revert "${changeRequest.title}"`,
            labels: [],
            related_issues: [],
            reviewers: [],
            changes: [
              {
                action: 'DELETE',
                schema_name: 'test',
                table_name: 'change_request_test',
                database_name: database.raw_name,
                id: expect.any(String),
                change_request_id: expect.any(String),
                index: 0,
                primary_keys: [
                  {
                    type: 'uuid',
                    ...primaryKeyPayload
                  }
                ],
                previous_fields: expect.arrayContaining([
                  expect.objectContaining({
                    type: 'uuid',
                    ...fieldPayload[1]
                  }),
                  expect.objectContaining({
                    type: 'string',
                    ...fieldPayload[0]
                  })
                ])
              }
            ]
          }
        }
      })
    } else if (statusCode === 404) {
      expectNotFound(response, 'database')
    }

    expect(response.statusCode).toBe(statusCode)
  }

  const testNotAppliedChangeRequest = async (
    creator: User,
    caller: User,
    connection: ConnectionType.ConnectionSelectWithEncryption,
    database: MetadataDatabase
  ) => {
    const testRecordId = randomUUID()

    const fieldPayload = [
      {
        column_name: 'test_text',
        value: 'test_text_value'
      },
      {
        column_name: 'id',
        value: testRecordId
      }
    ]
    const changes = [
      {
        action: 'ADD',
        schema_name: 'test',
        table_name: 'change_request_test',
        fields: fieldPayload
      }
    ] satisfies RequestChange[]

    const changeRequest = await createMockChangeRequest(
      creator,
      connection.visibility,
      changes
    )

    const response = await server.inject({
      headers: {
        authorization: `Bearer ${createSortJwt(caller.id)}`
      },
      method: 'POST',
      url: `/v2/orgs/${org.slug}/databases/${database.slug}/change-requests/${changeRequest.change_request_number}/undo`
    })

    expect(response.statusCode).toBe(409)
  }

  describe('undo change request operation', () => {
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

    paramsTester.testInvalidParams({
      method: 'POST',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/undo',
      userId: orgAdminUser.id
    })

    testInvalidSortAuthHeaders({
      method: 'POST',
      url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/123/undo`
    })

    paramsTester.testNotFound({
      method: 'POST',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/undo',
      userId: orgAdminUser.id,
      defaultPayload: defaultCreatePayload
    })

    it('should only undo change requests that have been applied', async () => {
      await testNotAppliedChangeRequest(
        orgAdminUser,
        orgAdminUser,
        pubConn,
        pubDbEntry
      )
    })

    describe('for Public Connections', () => {
      describe('when the caller is an Org Owner', () => {
        it('should respond with 201', async () => {
          for (const action of ['ADD', 'MODIFY', 'DELETE'] as const) {
            await testUndoCreateChangeRequest(
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
            await testUndoCreateChangeRequest(
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
            await testUndoCreateChangeRequest(
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
        it('should respond with 201', async () => {
          for (const action of ['ADD', 'MODIFY', 'DELETE'] as const) {
            await testUndoCreateChangeRequest(
              orgMemberUser1,
              nonOrgUser1,
              pubConn,
              pubDbEntry,
              201,
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
            await testUndoCreateChangeRequest(
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
            await testUndoCreateChangeRequest(
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
            await testUndoCreateChangeRequest(
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
