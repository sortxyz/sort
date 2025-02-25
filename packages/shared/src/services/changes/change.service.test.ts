import { randomUUID } from 'node:crypto'

import { createKysely, disconnectKysely, getDb, getConfig, logger } from '../..'
import { ChangeRequestMock } from '../../mocks/change-requests/change-request.mock'
import { ChangeRequestTestAllPrimaryKeysTableMock } from '../../mocks/change-requests/test-table-all-primary-keys.mock'
import { ChangeRequestTestTableMock } from '../../mocks/change-requests/test-table.mock'
import {
  ConnectionMock,
  postgresConnectionMock
} from '../../mocks/connection.mock'
import {
  MetadataDatabaseMock,
  MetadataTableMock
} from '../../mocks/metadata.mock'
import { OrganizationMock } from '../../mocks/org.mock'
import { SnapshotMock } from '../../mocks/snapshot/postgres.snapshot.mock'
import { SnapshotColumnMock } from '../../mocks/snapshot/snapshot-column.mock'
import { SnapshotDatabaseMock } from '../../mocks/snapshot/snapshot-database.mock'
import { SnapshotSchemaMock } from '../../mocks/snapshot/snapshot-schema.mock'
import { SnapshotTableMock } from '../../mocks/snapshot/snapshot-table.mock'
import { UserMock } from '../../mocks/user.mock'
import * as ChangeRequestService from '../../services/change-requests/change-request.service'
import * as ConnectionService from '../../services/connection.service'
import * as MetadataDatabaseService from '../../services/kysely/metadata/database.service'
import * as MetadataTableService from '../../services/kysely/metadata/table.service'
import * as OrganizationService from '../../services/org.service'
import * as UserService from '../../services/user.service'

import * as ChangeService from './change.service'

import type * as ChangeSchema from '../../schemas/change.schema'
import type * as OrganizationMemberSchema from '../../schemas/org-member.schema'
import type { MetadataDatabase } from '../../types/__generated/kysely.type'
import type { SortDB } from '../../types/kysely.type'
import type { User } from '../../types/user.type'
import type { Selectable } from 'kysely'

type Field = Selectable<SortDB['change_field_value']>

const userMock = new UserMock()
const orgMock = new OrganizationMock()
const snapshotMocks = new SnapshotMock()
const snapshotDatabaseMock = new SnapshotDatabaseMock()
const snapshotSchemaMock = new SnapshotSchemaMock()
const snapshotTableMock = new SnapshotTableMock()
const snapshotColumnMock = new SnapshotColumnMock()
const connMock = new ConnectionMock()
const dbMock = new MetadataDatabaseMock()
const tableMock = new MetadataTableMock()
const changeRequestMock = new ChangeRequestMock()
const testTableMock = new ChangeRequestTestTableMock()
const testTableAllPrimaryKeys = new ChangeRequestTestAllPrimaryKeysTableMock()

const orgOwner = userMock.create()
const org = orgMock.create()

async function cleanUp() {
  await testTableMock.removeAll()
  await testTableAllPrimaryKeys.removeAll()
  await connMock.removeAll()
  await snapshotColumnMock.removeAll()
  await snapshotTableMock.removeAll()
  await snapshotSchemaMock.removeAll()
  await snapshotDatabaseMock.removeAll()
  await snapshotMocks.removeAll()
  await orgMock.removeAll(true)
  await userMock.removeAll()
}

let createdChangeRequest1: Awaited<
  ReturnType<typeof ChangeRequestService.createChangeRequest>
>

let createdChangeRequest2: Awaited<
  ReturnType<typeof ChangeRequestService.createChangeRequest>
>

let dbEntry: MetadataDatabase
let orgOwnerMember: OrganizationMemberSchema.OrganizationMember
let user: User

describe('ChangeService', () => {
  describe('dbFieldToResponseField', () => {
    it('handles all types properly', () => {
      const now = new Date()

      const tests = [
        {
          expectation: {
            column_name: 'foo',
            type: 'null',
            value: null
          },
          field: {
            id: 'xyz',
            change_id: 'abcdef',
            column_name: 'foo',
            is_value_null: true,
            string_value: null,
            numeric_value: null,
            date_value: null,
            boolean_value: null,
            json_value: null,
            uuid_value: null,
            binary_value: null
          } satisfies Field
        },
        {
          expectation: {
            column_name: 'foo',
            type: 'string',
            value: 'hello world'
          },
          field: {
            id: 'xyz',
            change_id: 'abcdef',
            column_name: 'foo',
            is_value_null: false,
            string_value: 'hello world',
            numeric_value: null,
            date_value: null,
            boolean_value: null,
            json_value: null,
            uuid_value: null,
            binary_value: null
          } satisfies Field
        },
        {
          expectation: {
            column_name: 'foo',
            type: 'numeric',
            value: '3995.3333'
          },
          field: {
            id: 'xyz',
            change_id: 'abcdef',
            column_name: 'foo',
            is_value_null: false,
            string_value: null,
            numeric_value: '3995.3333',
            date_value: null,
            boolean_value: null,
            json_value: null,
            uuid_value: null,
            binary_value: null
          } satisfies Field
        },
        {
          expectation: {
            column_name: 'foo',
            type: 'date',
            value: now
          },
          field: {
            id: 'xyz',
            change_id: 'abcdef',
            column_name: 'foo',
            is_value_null: false,
            string_value: null,
            numeric_value: null,
            date_value: now,
            boolean_value: null,
            json_value: null,
            uuid_value: null,
            binary_value: null
          } satisfies Field
        },
        {
          expectation: {
            column_name: 'foo',
            type: 'boolean',
            value: false
          },
          field: {
            id: 'xyz',
            change_id: 'abcdef',
            column_name: 'foo',
            is_value_null: false,
            string_value: null,
            numeric_value: null,
            date_value: null,
            boolean_value: false,
            json_value: null,
            uuid_value: null,
            binary_value: null
          } satisfies Field
        },
        {
          expectation: {
            column_name: 'foo',
            type: 'boolean',
            value: true
          },
          field: {
            id: 'xyz',
            change_id: 'abcdef',
            column_name: 'foo',
            is_value_null: false,
            string_value: null,
            numeric_value: null,
            date_value: null,
            boolean_value: true,
            json_value: null,
            uuid_value: null,
            binary_value: null
          } satisfies Field
        },
        {
          expectation: {
            column_name: 'foo',
            type: 'json',
            value: JSON.stringify({ works: [1, 2, 3] })
          },
          field: {
            id: 'xyz',
            change_id: 'abcdef',
            column_name: 'foo',
            is_value_null: false,
            string_value: null,
            numeric_value: null,
            date_value: null,
            boolean_value: null,
            json_value: { works: [1, 2, 3] },
            uuid_value: null,
            binary_value: null
          } satisfies Field
        },
        {
          expectation: {
            column_name: 'foo',
            type: 'uuid',
            value: '81bdfe4a-3101-45d5-879b-526b013a00a8'
          },
          field: {
            id: 'xyz',
            change_id: 'abcdef',
            column_name: 'foo',
            is_value_null: false,
            string_value: null,
            numeric_value: null,
            date_value: null,
            boolean_value: null,
            json_value: null,
            uuid_value: '81bdfe4a-3101-45d5-879b-526b013a00a8',
            binary_value: null
          } satisfies Field
        },
        {
          expectation: {
            column_name: 'foo',
            type: 'binary',
            value: Buffer.from('hello world').toString('base64')
          },
          field: {
            id: 'xyz',
            change_id: 'abcdef',
            column_name: 'foo',
            is_value_null: false,
            string_value: null,
            numeric_value: null,
            date_value: null,
            boolean_value: null,
            json_value: null,
            uuid_value: null,
            binary_value: Buffer.from('hello world')
          } satisfies Field
        }
      ]

      for (const test of tests) {
        const responseField = ChangeService.dbFieldToResponseField(test.field)
        expect(responseField).toEqual(test.expectation)
      }
    })
  })

  describe('insertChangeFieldValue', () => {
    beforeAll(async () => {
      createKysely({ config: getConfig(), sortLogger: logger })
      user = await UserService.createUser(orgOwner)

      await OrganizationService.create({
        ...org,
        created_by: user.id
      })

      const conn = connMock.create({
        ...postgresConnectionMock,
        organization_id: org.id,
        created_by: user.id
      })
      await ConnectionService.create(conn)

      dbEntry = dbMock.create({
        raw_name: 'sort_xyz',
        organization_id: org.id,
        connection_id: conn.id
      })
      await MetadataDatabaseService.insertMetadataDb(getDb(), dbEntry)
      const tableEntry = tableMock.create({
        connection_id: conn.id,
        raw_database_name: dbEntry.raw_name,
        raw_schema_name: 'test',
        raw_name: 'change_request_test'
      })
      await MetadataTableService.insertTable(tableEntry)

      const tableEntry2 = tableMock.create({
        connection_id: conn.id,
        raw_database_name: dbEntry.raw_name,
        raw_schema_name: 'test',
        raw_name: 'change_request_test_all_primary_keys'
      })
      await MetadataTableService.insertTable(tableEntry2)

      const snapshot = snapshotMocks.create({
        status: 'COMPLETED',
        connection_id: conn.id
      })
      await getDb().insertInto('snapshot').values(snapshot).execute()

      const snapshotDatabase = snapshotDatabaseMock.create({
        name: dbEntry.raw_name,
        snapshot_id: snapshot.id
      })
      await getDb()
        .insertInto('snapshot_database')
        .values(snapshotDatabase)
        .executeTakeFirstOrThrow()

      const snapshotSchema = snapshotSchemaMock.create({
        name: tableEntry.raw_schema_name,
        database_id: snapshotDatabase.id
      })
      await getDb()
        .insertInto('snapshot_schema')
        .values(snapshotSchema)
        .executeTakeFirstOrThrow()

      const snapshotTable = snapshotTableMock.create({
        name: tableEntry.raw_name,
        schema_id: snapshotSchema.id
      })
      await getDb()
        .insertInto('snapshot_table')
        .values(snapshotTable)
        .executeTakeFirstOrThrow()

      const snapshotTable2 = snapshotTableMock.create({
        name: tableEntry2.raw_name,
        schema_id: snapshotSchema.id
      })
      await getDb()
        .insertInto('snapshot_table')
        .values(snapshotTable2)
        .executeTakeFirstOrThrow()

      const snapshotColumns = [
        snapshotColumnMock.create({
          table_id: snapshotTable.id,
          is_primary_key: true,
          name: 'id',
          type: 'uuid',
          nullable: false
        }),
        snapshotColumnMock.create({
          table_id: snapshotTable.id,
          is_primary_key: false,
          name: 'test_uuid',
          type: 'uuid',
          nullable: true
        }),
        snapshotColumnMock.create({
          table_id: snapshotTable.id,
          is_primary_key: false,
          name: 'test_numeric',
          type: 'numeric',
          nullable: true
        }),
        snapshotColumnMock.create({
          table_id: snapshotTable.id,
          is_primary_key: false,
          name: 'test_boolean',
          type: 'boolean',
          nullable: true
        }),
        snapshotColumnMock.create({
          table_id: snapshotTable.id,
          is_primary_key: false,
          name: 'test_jsonb',
          type: 'json',
          nullable: true
        }),
        snapshotColumnMock.create({
          table_id: snapshotTable.id,
          is_primary_key: false,
          name: 'test_text',
          type: 'text',
          nullable: true
        }),
        snapshotColumnMock.create({
          table_id: snapshotTable.id,
          is_primary_key: false,
          name: 'test_timestamp',
          type: 'date',
          nullable: true
        }),
        snapshotColumnMock.create({
          table_id: snapshotTable.id,
          is_primary_key: false,
          name: 'test_timestamptz',
          type: 'date',
          nullable: true
        }),
        snapshotColumnMock.create({
          table_id: snapshotTable.id,
          is_primary_key: false,
          name: 'test_date',
          type: 'date',
          nullable: true
        }),
        snapshotColumnMock.create({
          table_id: snapshotTable.id,
          is_primary_key: false,
          name: 'test_binary',
          type: 'binary',
          nullable: true
        })
      ]

      await getDb()
        .insertInto('snapshot_column')
        .values(snapshotColumns)
        .execute()

      const snapshotColumns2 = [
        snapshotColumnMock.create({
          table_id: snapshotTable2.id,
          is_primary_key: true,
          name: 'id',
          type: 'uuid',
          nullable: false
        }),
        snapshotColumnMock.create({
          table_id: snapshotTable2.id,
          is_primary_key: true,
          name: 'numeric_id',
          type: 'numeric',
          nullable: false
        }),
        snapshotColumnMock.create({
          table_id: snapshotTable2.id,
          is_primary_key: true,
          name: 'boolean_id',
          type: 'bool',
          nullable: false
        }),
        snapshotColumnMock.create({
          table_id: snapshotTable2.id,
          is_primary_key: true,
          name: 'jsonb_id',
          type: 'json',
          nullable: false
        }),
        snapshotColumnMock.create({
          table_id: snapshotTable2.id,
          is_primary_key: true,
          name: 'timestamp_id',
          type: 'date',
          nullable: false
        }),
        snapshotColumnMock.create({
          table_id: snapshotTable2.id,
          is_primary_key: true,
          name: 'binary_id',
          type: 'bytea',
          nullable: false
        })
      ]

      await getDb()
        .insertInto('snapshot_column')
        .values(snapshotColumns2)
        .execute()

      // TODO: We need an OrgMember mock
      orgOwnerMember = {
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          picture: user.picture
        },
        role: {
          id: 0,
          name: 'owner'
        }
      } satisfies OrganizationMemberSchema.OrganizationMember
    })

    beforeEach(async () => {
      const mockChangeRequest = changeRequestMock.create({
        id: randomUUID(),
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Detailed Test Change Request',
        description: 'This change request has all possible fields defined.',
        labels: [],
        reviewers: [orgOwnerMember]
      })

      createdChangeRequest1 =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      const mockChangeRequest2 = changeRequestMock.create({
        id: randomUUID(),
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Detailed Test Change Request 2',
        description:
          'This change request has all possible primary keys fields defined.',
        labels: [],
        reviewers: [orgOwnerMember]
      })

      createdChangeRequest2 =
        await ChangeRequestService.createChangeRequest(mockChangeRequest2)

      expect(createdChangeRequest2).toBeDefined()
    })

    afterAll(async () => {
      await cleanUp()
      await disconnectKysely()
    })

    it('inserts a change field value', async () => {
      const change = {
        id: randomUUID(),
        change_request_id: createdChangeRequest1.id,
        index: 0,
        action: 'ADD',
        connection_id: createdChangeRequest1.connection_id,
        metadata_database_name: 'sort_xyz',
        metadata_schema_name: 'test',
        metadata_table_name: 'change_request_test'
      } satisfies ChangeSchema.Change
      const insertedChange = await ChangeService.insertChange(getDb(), change)

      const fieldValue = {
        id: randomUUID(),
        change_id: insertedChange.id,
        column_name: 'id',
        string_value: 'hello world',
        numeric_value: '3995.3333',
        date_value: new Date(),
        boolean_value: true,
        json_value: { works: [1, 2, 3] },
        uuid_value: '81bdfe4a-3101-45d5-879b-526b013a00a8',
        binary_value: Buffer.from('hello world').toString('base64'),
        is_value_null: false
      } satisfies ChangeSchema.ChangeFieldValue

      const ret = await ChangeService.insertChangeFieldValue(
        getDb(),
        fieldValue
      )
      expect(ret).toEqual({
        ...fieldValue,
        binary_value: Buffer.from('hello world')
      })

      const result = await getDb()
        .selectFrom('change_field_value')
        .where('id', '=', ret.id)
        .selectAll()
        .executeTakeFirstOrThrow()

      expect(result).toEqual(ret)
    })
  })
})
