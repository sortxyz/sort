/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { randomUUID } from 'crypto'

import { createKysely, disconnectKysely, getDb } from '../..'
import { uuidFormat } from '../../constants/type-mask.constant'
import { ChangeRequestMock } from '../../mocks/change-requests/change-request.mock'
import { ChangeMock } from '../../mocks/change-requests/change.mock'
import { ChangeRequestTestTableUnsupportedTypesMock } from '../../mocks/change-requests/test-table-unsupported-types.mock'
import { ChangeRequestTestTableMock } from '../../mocks/change-requests/test-table.mock'
import { ConnectionMock } from '../../mocks/connection.mock'
import { createFastifyMockLogger } from '../../mocks/fastify-logger.mock'
import { OrganizationMock } from '../../mocks/org.mock'
import { SnapshotMock } from '../../mocks/snapshot/snapshot.mock'
import { UserMock } from '../../mocks/user.mock'
import * as ChangeRequestService from '../../services/change-requests/change-request.service'
import * as ChangeService from '../../services/changes/change.service'
import * as ConnectionService from '../../services/connection.service'
import * as OrganizationService from '../../services/org.service'
import { PostgresSchemaImportService } from '../../services/schema-import/pg/schema-import.service'
import * as UserService from '../../services/user.service'

import {
  isEqual,
  storePreviousChanges,
  getFieldValues
} from './previous-change.service'

import type { ChangePrimaryKey } from '../../schemas/change.schema'
import type { QueryColumn } from '../../schemas/query-execution.schema'

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('Tests for Postgres Intent Query Execution', () => {
  const userMock = new UserMock()
  const connMock = new ConnectionMock()
  const orgMock = new OrganizationMock()
  const snapshotMocks = new SnapshotMock()
  const changeMock = new ChangeMock()
  const changeRequestMock = new ChangeRequestMock()
  const testTableMock = new ChangeRequestTestTableMock()
  const testTableUnsupportedTypesMock =
    new ChangeRequestTestTableUnsupportedTypesMock()

  const user = userMock.create()
  const user2 = userMock.create()
  const org = orgMock.create({
    created_by: user.id
  })
  const conn = connMock.create({
    organization_id: org.id,
    created_by: user.id
  })

  beforeAll(async () => {
    createKysely()

    await UserService.createUser(user)
    await UserService.createUser(user2)
    await OrganizationService.create(org)
    await ConnectionService.create(conn)
  })

  afterAll(async () => {
    await changeMock.removeAll()
    await changeRequestMock.removeAll()
    await connMock.removeAll()
    await getDb()
      .deleteFrom('organization_user')
      .where('user_id', 'in', [user.id, user2.id])
      .execute()
    await orgMock.removeAll()
    await userMock.removeAll()
    await snapshotMocks.removeAll()

    await disconnectKysely()
  })

  afterEach(async () => {
    await testTableMock.removeAll()
    await testTableUnsupportedTypesMock.removeAll()
  })

  describe('previous change service', () => {
    describe('#isEqual', () => {
      it('should throw on unequal column names', () => {
        expect(() =>
          isEqual(
            {
              column_name: 'test_timestamp',
              id: randomUUID(),
              change_id: randomUUID()
            },
            { name: 'test_numeric', type: 'numeric' },
            100
          )
        ).toThrow('column "test_timestamp" not found')
      })

      it.each([
        {
          primaryKey: {
            id: randomUUID(),
            change_id: randomUUID(),
            column_name: 'test_timestamp',
            string_value: undefined,
            numeric_value: undefined,
            date_value: new Date('2024-05-16T15:04:05Z'),
            boolean_value: undefined,
            json_value: undefined,
            uuid_value: undefined
          } satisfies ChangePrimaryKey,
          col: {
            name: 'test_timestamp',
            type: 'date'
          } satisfies QueryColumn,
          value: new Date('2024-05-16T15:04:05Z')
        },
        {
          primaryKey: {
            id: randomUUID(),
            change_id: randomUUID(),
            column_name: 'test_boolean',
            string_value: undefined,
            numeric_value: undefined,
            date_value: undefined,
            boolean_value: true,
            json_value: undefined,
            uuid_value: undefined
          } satisfies ChangePrimaryKey,
          col: {
            name: 'test_boolean',
            type: 'boolean'
          } satisfies QueryColumn,
          value: true
        },
        {
          primaryKey: {
            id: randomUUID(),
            change_id: randomUUID(),
            column_name: 'test_numeric',
            string_value: undefined,
            numeric_value: 100,
            date_value: undefined,
            boolean_value: undefined,
            json_value: undefined,
            uuid_value: undefined
          } satisfies ChangePrimaryKey,
          col: {
            name: 'test_numeric',
            type: 'numeric'
          } satisfies QueryColumn,
          value: 100
        },
        {
          primaryKey: {
            id: randomUUID(),
            change_id: randomUUID(),
            column_name: 'test_numeric',
            string_value: undefined,
            numeric_value: '100',
            date_value: undefined,
            boolean_value: undefined,
            json_value: undefined,
            uuid_value: undefined
          } satisfies ChangePrimaryKey,
          col: {
            name: 'test_numeric',
            type: 'numeric'
          } satisfies QueryColumn,
          value: 100
        },
        {
          primaryKey: {
            id: randomUUID(),
            change_id: randomUUID(),
            column_name: 'test_string',
            string_value: 'test',
            numeric_value: undefined,
            date_value: undefined,
            boolean_value: undefined,
            json_value: undefined,
            uuid_value: undefined
          } satisfies ChangePrimaryKey,
          col: {
            name: 'test_string',
            type: 'string'
          } satisfies QueryColumn,
          value: 'test'
        },
        {
          primaryKey: {
            id: randomUUID(),
            change_id: randomUUID(),
            column_name: 'test_uuid',
            string_value: undefined,
            numeric_value: undefined,
            date_value: undefined,
            boolean_value: undefined,
            json_value: undefined,
            uuid_value: '568bfc78-573b-4ab6-bdb5-ef943dedae46'
          } satisfies ChangePrimaryKey,
          col: {
            name: 'test_uuid',
            type: 'uuid'
          } satisfies QueryColumn,
          value: '568bfc78-573b-4ab6-bdb5-ef943dedae46'
        },
        {
          primaryKey: {
            id: randomUUID(),
            change_id: randomUUID(),
            column_name: 'test_binary',
            string_value: undefined,
            numeric_value: undefined,
            date_value: undefined,
            boolean_value: undefined,
            json_value: undefined,
            uuid_value: undefined,
            binary_value: 'hello world'
          } satisfies ChangePrimaryKey,
          col: {
            name: 'test_binary',
            type: 'binary'
          } satisfies QueryColumn,
          value: Buffer.from('hello world')
        }
      ])(
        'should return true if passed values are equal for $col.name and value $value',
        ({
          primaryKey,
          col,
          value
        }: {
          primaryKey: ChangePrimaryKey
          col: QueryColumn
          value: unknown
        }) => {
          expect(isEqual(primaryKey, col, value))
        }
      )

      it.each([
        {
          primaryKey: {
            id: randomUUID(),
            change_id: randomUUID(),
            column_name: 'test_timestamp',
            string_value: undefined,
            numeric_value: undefined,
            date_value: new Date('2024-05-16T15:04:05Z'),
            boolean_value: undefined,
            json_value: undefined,
            uuid_value: undefined
          } satisfies ChangePrimaryKey,
          col: {
            name: 'test_timestamp',
            type: 'date'
          } satisfies QueryColumn,
          value: new Date('2024-05-16T14:04:05Z')
        },
        {
          primaryKey: {
            id: randomUUID(),
            change_id: randomUUID(),
            column_name: 'test_boolean',
            string_value: undefined,
            numeric_value: undefined,
            date_value: undefined,
            boolean_value: true,
            json_value: undefined,
            uuid_value: undefined
          } satisfies ChangePrimaryKey,
          col: {
            name: 'test_boolean',
            type: 'boolean'
          } satisfies QueryColumn,
          value: false
        },
        {
          primaryKey: {
            id: randomUUID(),
            change_id: randomUUID(),
            column_name: 'test_string',
            string_value: 'test',
            numeric_value: undefined,
            date_value: undefined,
            boolean_value: undefined,
            json_value: undefined,
            uuid_value: undefined
          } satisfies ChangePrimaryKey,
          col: {
            name: 'test_string',
            type: 'string'
          } satisfies QueryColumn,
          value: 'tesssst'
        },
        {
          primaryKey: {
            id: randomUUID(),
            change_id: randomUUID(),
            column_name: 'test_string',
            string_value: '',
            numeric_value: undefined,
            date_value: undefined,
            boolean_value: undefined,
            json_value: undefined,
            uuid_value: undefined
          } satisfies ChangePrimaryKey,
          col: {
            name: 'test_string',
            type: 'string'
          } satisfies QueryColumn,
          value: 'tesssst'
        },
        {
          primaryKey: {
            id: randomUUID(),
            change_id: randomUUID(),
            column_name: 'test_numeric',
            string_value: undefined,
            numeric_value: '101',
            date_value: undefined,
            boolean_value: undefined,
            json_value: undefined,
            uuid_value: undefined
          } satisfies ChangePrimaryKey,
          col: {
            name: 'test_numeric',
            type: 'numeric'
          } satisfies QueryColumn,
          value: 100
        },
        {
          primaryKey: {
            id: randomUUID(),
            change_id: randomUUID(),
            column_name: 'test_uuid',
            string_value: undefined,
            numeric_value: undefined,
            date_value: undefined,
            boolean_value: undefined,
            json_value: undefined,
            uuid_value: '568bfc78-573b-4ab6-bdb5-ef943dedae46'
          } satisfies ChangePrimaryKey,
          col: {
            name: 'test_uuid',
            type: 'uuid'
          } satisfies QueryColumn,
          value: '568bfc78-573b-4ab6-bdb5-ef943dedae47'
        }
      ])(
        'should return false if passed values are not equal for $col.name and value $value',
        ({
          primaryKey,
          col,
          value
        }: {
          primaryKey: ChangePrimaryKey
          col: QueryColumn
          value: unknown
        }) => {
          expect(isEqual(primaryKey, col, value) === false)
        }
      )

      it.each([
        {
          primaryKey: {
            id: randomUUID(),
            change_id: randomUUID(),
            column_name: 'test_timestamp',
            string_value: undefined,
            numeric_value: undefined,
            date_value: undefined,
            boolean_value: undefined,
            json_value: undefined,
            uuid_value: undefined
          } satisfies ChangePrimaryKey,
          col: {
            name: 'test_timestamp',
            type: 'date'
          } satisfies QueryColumn,
          value: new Date('2024-05-16T14:04:05Z')
        },
        {
          primaryKey: {
            id: randomUUID(),
            change_id: randomUUID(),
            column_name: 'test_boolean',
            string_value: undefined,
            numeric_value: undefined,
            date_value: undefined,
            boolean_value: undefined,
            json_value: undefined,
            uuid_value: undefined
          } satisfies ChangePrimaryKey,
          col: {
            name: 'test_boolean',
            type: 'boolean'
          } satisfies QueryColumn,
          value: false
        },
        {
          primaryKey: {
            id: randomUUID(),
            change_id: randomUUID(),
            column_name: 'test_string',
            string_value: undefined,
            numeric_value: undefined,
            date_value: undefined,
            boolean_value: undefined,
            json_value: undefined,
            uuid_value: undefined
          } satisfies ChangePrimaryKey,
          col: {
            name: 'test_string',
            type: 'string'
          } satisfies QueryColumn,
          value: 'tesssst'
        },
        {
          primaryKey: {
            id: randomUUID(),
            change_id: randomUUID(),
            column_name: 'test_numeric',
            string_value: undefined,
            numeric_value: undefined,
            date_value: undefined,
            boolean_value: undefined,
            json_value: undefined,
            uuid_value: undefined
          } satisfies ChangePrimaryKey,
          col: {
            name: 'test_numeric',
            type: 'numeric'
          } satisfies QueryColumn,
          value: 100
        },
        {
          primaryKey: {
            id: randomUUID(),
            change_id: randomUUID(),
            column_name: 'test_uuid',
            string_value: undefined,
            numeric_value: undefined,
            date_value: undefined,
            boolean_value: undefined,
            json_value: undefined,
            uuid_value: undefined
          } satisfies ChangePrimaryKey,
          col: {
            name: 'test_uuid',
            type: 'uuid'
          } satisfies QueryColumn,
          value: '568bfc78-573b-4ab6-bdb5-ef943dedae47'
        }
      ])(
        'should return false if passed values are whole but undefined for $col.name and value $value',
        ({
          primaryKey,
          col,
          value
        }: {
          primaryKey: ChangePrimaryKey
          col: QueryColumn
          value: unknown
        }) => {
          expect(isEqual(primaryKey, col, value) === false)
        }
      )

      it.each([
        {
          primaryKey: {
            id: randomUUID(),
            change_id: randomUUID(),
            column_name: 'test_timestamp',
            string_value: undefined,
            numeric_value: undefined,
            date_value: undefined,
            boolean_value: undefined,
            json_value: undefined,
            uuid_value: undefined
          } satisfies ChangePrimaryKey,
          col: {
            name: 'test_timestamp',
            type: 'date'
          } satisfies QueryColumn,
          value: 'kdfsksdfk'
        },
        {
          primaryKey: {
            id: randomUUID(),
            change_id: randomUUID(),
            column_name: 'test_boolean',
            string_value: undefined,
            numeric_value: undefined,
            date_value: undefined,
            boolean_value: undefined,
            json_value: undefined,
            uuid_value: undefined
          } satisfies ChangePrimaryKey,
          col: {
            name: 'test_boolean',
            type: 'boolean'
          } satisfies QueryColumn,
          value: 'nope'
        },
        {
          primaryKey: {
            id: randomUUID(),
            change_id: randomUUID(),
            column_name: 'test_string',
            string_value: undefined,
            numeric_value: undefined,
            date_value: undefined,
            boolean_value: undefined,
            json_value: undefined,
            uuid_value: undefined
          } satisfies ChangePrimaryKey,
          col: {
            name: 'test_string',
            type: 'string'
          } satisfies QueryColumn,
          value: 200
        },
        {
          primaryKey: {
            id: randomUUID(),
            change_id: randomUUID(),
            column_name: 'test_numeric',
            string_value: undefined,
            numeric_value: undefined,
            date_value: undefined,
            boolean_value: undefined,
            json_value: undefined,
            uuid_value: undefined
          } satisfies ChangePrimaryKey,
          col: {
            name: 'test_numeric',
            type: 'numeric'
          } satisfies QueryColumn,
          value: new Date()
        },
        {
          primaryKey: {
            id: randomUUID(),
            change_id: randomUUID(),
            column_name: 'test_uuid',
            string_value: undefined,
            numeric_value: undefined,
            date_value: undefined,
            boolean_value: undefined,
            json_value: undefined,
            uuid_value: undefined
          } satisfies ChangePrimaryKey,
          col: {
            name: 'test_uuid',
            type: 'uuid'
          } satisfies QueryColumn,
          value: '5fc78-573b-4ab6-bdb5-ef943dedae47'
        }
      ])(
        'should throw if values are mismatched to the type for $col.name and value $value',
        ({
          primaryKey,
          col,
          value
        }: {
          primaryKey: ChangePrimaryKey
          col: QueryColumn
          value: unknown
        }) => {
          expect(() => isEqual(primaryKey, col, value)).toThrow()
        }
      )
    })

    describe('#storePreviousChanges', () => {
      it('should store two records with two separate primary keys (boolean, date)', async () => {
        const pg = new PostgresSchemaImportService(conn)

        const log = createFastifyMockLogger()
        const ssId = await pg.importSchema(user.id, log)

        snapshotMocks.push(ssId)

        const changeRequestId = randomUUID()

        const changeIdOne = randomUUID()
        const changeIdTwo = randomUUID()

        const recordIdOne = randomUUID()
        const recordIdTwo = randomUUID()

        const changeRequest = changeRequestMock.create({
          id: changeRequestId,
          connection_id: conn.id,
          database_name: 'sort_xyz',
          created_by: user.id
        })
        await ChangeRequestService.createChangeRequest({
          ...changeRequest,
          labels: [],
          reviewers: [],
          changes: []
        })

        const changeOne = changeMock.create({
          id: changeIdOne,
          change_request_id: changeRequestId,
          connection_id: conn.id,
          metadata_database_name: 'sort_xyz',
          metadata_schema_name: 'test',
          metadata_table_name: 'change_request_test'
        })
        await ChangeService.insertChange(getDb(), changeOne)

        const changeTwo = changeMock.create({
          id: changeIdTwo,
          change_request_id: changeRequestId,
          connection_id: conn.id,
          metadata_database_name: 'sort_xyz',
          metadata_schema_name: 'test',
          metadata_table_name: 'change_request_test'
        })
        await ChangeService.insertChange(getDb(), changeTwo)

        const primaryKeysOne = [
          {
            id: randomUUID(),
            change_id: changeIdOne,
            column_name: 'test_timestamp',
            string_value: undefined,
            numeric_value: undefined,
            date_value: new Date('2024-05-16T15:04:05Z'),
            boolean_value: undefined,
            json_value: undefined,
            uuid_value: undefined
          } satisfies ChangePrimaryKey,
          {
            id: randomUUID(),
            change_id: changeIdOne,
            column_name: 'test_boolean',
            string_value: undefined,
            numeric_value: undefined,
            date_value: undefined,
            boolean_value: true,
            json_value: undefined,
            uuid_value: undefined
          } satisfies ChangePrimaryKey
        ]
        await Promise.all(
          primaryKeysOne.map(pk =>
            ChangeService.insertChangePrimaryKey(getDb(), pk)
          )
        )

        const primaryKeysTwo = [
          {
            id: randomUUID(),
            change_id: changeIdTwo,
            column_name: 'test_timestamp',
            string_value: undefined,
            numeric_value: undefined,
            date_value: new Date('2024-05-15T15:04:05Z'),
            boolean_value: undefined,
            json_value: undefined,
            uuid_value: undefined
          } satisfies ChangePrimaryKey,
          {
            id: randomUUID(),
            change_id: changeIdTwo,
            column_name: 'test_boolean',
            string_value: undefined,
            date_value: undefined,
            numeric_value: undefined,
            boolean_value: true,
            json_value: undefined,
            uuid_value: undefined
          } satisfies ChangePrimaryKey
        ]
        await Promise.all(
          primaryKeysTwo.map(pk =>
            ChangeService.insertChangePrimaryKey(getDb(), pk)
          )
        )

        const recordOne = testTableMock.create({
          id: recordIdOne,
          test_numeric: '100',
          test_uuid: randomUUID(),
          test_timestamp: new Date('2024-05-16T15:04:05Z'),
          test_boolean: true,
          test_jsonb: { test: 'test' },
          test_text: 'test',
          test_binary: Buffer.from('hello world')
        })
        await testTableMock.insert(recordOne)

        const recordTwo = testTableMock.create({
          id: recordIdTwo,
          test_numeric: '200',
          test_uuid: randomUUID(),
          test_timestamp: new Date('2024-05-15T15:04:05Z'),
          test_boolean: true,
          test_jsonb: { test: 'test' },
          test_text: 'test',
          test_binary: Buffer.from('hello world')
        })
        await testTableMock.insert(recordTwo)

        await testTableMock.insert(
          testTableMock.create({
            id: randomUUID(),
            test_numeric: '300',
            test_uuid: randomUUID(),
            test_timestamp: new Date(),
            test_boolean: true,
            test_jsonb: { test: 'test' },
            test_text: 'test',
            test_binary: Buffer.from('hello world')
          })
        )

        await getDb()
          .transaction()
          .execute(async trx => {
            await storePreviousChanges({
              trx,
              changes: [
                {
                  ...changeOne,
                  primary_keys: primaryKeysOne,
                  fields: [],
                  previous_fields: []
                },
                {
                  ...changeTwo,
                  primary_keys: primaryKeysTwo,
                  fields: [],
                  previous_fields: []
                }
              ]
            })
          })

        const result = await getDb()
          .selectFrom('change_previous_field_value')
          .where('change_id', '=', changeIdOne)
          .selectAll()
          .execute()

        expect(result).toHaveLength(10)

        expect(result.map(r => r.column_name)).toEqual(
          expect.arrayContaining([
            'test_numeric',
            'test_uuid',
            'test_timestamp',
            'test_boolean',
            'test_jsonb',
            'test_text',
            'test_binary',
            'id'
          ])
        )
      })

      it('should store one record with matching major (numeric, boolean, string, etc.) fields', async () => {
        const pg = new PostgresSchemaImportService(conn)

        const log = createFastifyMockLogger()
        const ssId = await pg.importSchema(user.id, log)

        snapshotMocks.push(ssId)

        const changeRequestId = randomUUID()

        const changeIdOne = randomUUID()

        const recordIdOne = randomUUID()

        const changeRequest = changeRequestMock.create({
          id: changeRequestId,
          connection_id: conn.id,
          database_name: 'sort_xyz',
          created_by: user.id
        })
        await ChangeRequestService.createChangeRequest({
          ...changeRequest,
          labels: [],
          reviewers: [],
          changes: []
        })

        const changeOne = changeMock.create({
          id: changeIdOne,
          change_request_id: changeRequestId,
          connection_id: conn.id,
          metadata_database_name: 'sort_xyz',
          metadata_schema_name: 'test',
          metadata_table_name: 'change_request_test'
        })
        await ChangeService.insertChange(getDb(), changeOne)

        const primaryKeysOne = [
          {
            id: randomUUID(),
            change_id: changeIdOne,
            column_name: 'id',
            string_value: undefined,
            numeric_value: undefined,
            date_value: undefined,
            boolean_value: undefined,
            json_value: undefined,
            uuid_value: recordIdOne,
            binary_value: undefined
          } satisfies ChangePrimaryKey
        ]
        await ChangeService.insertChangePrimaryKey(getDb(), primaryKeysOne[0])

        const recordOneBase = {
          id: recordIdOne,
          test_numeric: '100',
          test_uuid: randomUUID(),
          test_timestamp: new Date('2024-05-16T15:04:05.088Z'),
          test_boolean: true,
          test_jsonb: { test: 'test' },
          test_text: 'test',
          test_binary: Buffer.from('hello world')
        }
        const recordOne = testTableMock.create(recordOneBase)
        await testTableMock.insert(recordOne)

        await getDb()
          .transaction()
          .execute(async trx => {
            await storePreviousChanges({
              trx,
              changes: [
                {
                  ...changeOne,
                  primary_keys: primaryKeysOne,
                  fields: [],
                  previous_fields: []
                }
              ]
            })
          })

        const result = await getDb()
          .selectFrom('change_previous_field_value')
          .where('change_id', '=', changeIdOne)
          .selectAll()
          .execute()

        expect(result).toHaveLength(10)

        expect(result.map(r => r.column_name)).toEqual(
          expect.arrayContaining([
            'test_numeric',
            'test_uuid',
            'test_timestamp',
            'test_boolean',
            'test_jsonb',
            'test_binary',
            'test_text',
            'id'
          ])
        )

        expect(result.map(r => r.date_value)).toEqual(
          expect.arrayContaining([recordOneBase.test_timestamp])
        )

        expect(result.map(r => r.numeric_value)).toEqual(
          expect.arrayContaining([recordOneBase.test_numeric])
        )

        expect(result.map(r => r.uuid_value)).toEqual(
          expect.arrayContaining([recordOneBase.test_uuid])
        )

        expect(result.map(r => r.boolean_value)).toEqual(
          expect.arrayContaining([recordOneBase.test_boolean])
        )

        expect(result.map(r => r.json_value)).toEqual(
          expect.arrayContaining([recordOneBase.test_jsonb])
        )

        expect(result.map(r => r.string_value)).toEqual(
          expect.arrayContaining([recordOneBase.test_text])
        )

        expect(result.map(r => r.binary_value)).toEqual(
          expect.arrayContaining([recordOneBase.test_binary])
        )
      })

      it('should store two records with one primary key (uuid)', async () => {
        const pg = new PostgresSchemaImportService(conn)

        const log = createFastifyMockLogger()
        const ssId = await pg.importSchema(user.id, log)

        snapshotMocks.push(ssId)

        const changeRequestId = randomUUID()

        const changeIdOne = randomUUID()
        const changeIdTwo = randomUUID()

        const recordIdOne = randomUUID()
        const recordIdTwo = randomUUID()

        const changeRequest = changeRequestMock.create({
          id: changeRequestId,
          connection_id: conn.id,
          database_name: 'sort_xyz',
          created_by: user.id
        })
        await ChangeRequestService.createChangeRequest({
          ...changeRequest,
          labels: [],
          reviewers: [],
          changes: []
        })

        const changeOne = changeMock.create({
          id: changeIdOne,
          change_request_id: changeRequestId,
          connection_id: conn.id,
          metadata_database_name: 'sort_xyz',
          metadata_schema_name: 'test',
          metadata_table_name: 'change_request_test'
        })
        await ChangeService.insertChange(getDb(), changeOne)

        const changeTwo = changeMock.create({
          id: changeIdTwo,
          change_request_id: changeRequestId,
          connection_id: conn.id,
          metadata_database_name: 'sort_xyz',
          metadata_schema_name: 'test',
          metadata_table_name: 'change_request_test'
        })
        await ChangeService.insertChange(getDb(), changeTwo)

        const primaryKeysOne = [
          {
            id: randomUUID(),
            change_id: changeIdOne,
            column_name: 'id',
            string_value: undefined,
            numeric_value: undefined,
            date_value: undefined,
            boolean_value: undefined,
            json_value: undefined,
            uuid_value: recordIdOne
          } satisfies ChangePrimaryKey
        ]
        await ChangeService.insertChangePrimaryKey(getDb(), primaryKeysOne[0])

        const primaryKeysTwo = [
          {
            id: randomUUID(),
            change_id: changeIdTwo,
            column_name: 'id',
            string_value: undefined,
            numeric_value: undefined,
            date_value: undefined,
            boolean_value: undefined,
            json_value: undefined,
            uuid_value: recordIdTwo
          } satisfies ChangePrimaryKey
        ]
        await ChangeService.insertChangePrimaryKey(getDb(), primaryKeysTwo[0])

        const recordOne = testTableMock.create({
          id: recordIdOne,
          test_numeric: '100',
          test_uuid: randomUUID(),
          test_timestamp: new Date('2024-05-16T15:04:05Z'),
          test_boolean: true,
          test_jsonb: { test: 'test' },
          test_text: 'test'
        })
        await testTableMock.insert(recordOne)

        const recordTwo = testTableMock.create({
          id: recordIdTwo,
          test_numeric: '200',
          test_uuid: randomUUID(),
          test_timestamp: new Date('2024-05-15T15:04:05Z'),
          test_boolean: true,
          test_jsonb: { test: 'test' },
          test_text: 'test'
        })
        await testTableMock.insert(recordTwo)

        await testTableMock.insert(
          testTableMock.create({
            id: randomUUID(),
            test_numeric: '300',
            test_uuid: randomUUID(),
            test_timestamp: new Date(),
            test_boolean: true,
            test_jsonb: { test: 'test' },
            test_text: 'test'
          })
        )

        await getDb()
          .transaction()
          .execute(async trx => {
            await storePreviousChanges({
              trx,
              changes: [
                {
                  ...changeOne,
                  primary_keys: primaryKeysOne,
                  fields: [],
                  previous_fields: []
                },
                {
                  ...changeTwo,
                  primary_keys: primaryKeysTwo,
                  fields: [],
                  previous_fields: []
                }
              ]
            })
          })

        const result = await getDb()
          .selectFrom('change_previous_field_value')
          .where('change_id', '=', changeIdOne)
          .selectAll()
          .execute()

        expect(result).toHaveLength(10)

        expect(result.map(r => r.column_name)).toEqual(
          expect.arrayContaining([
            'test_numeric',
            'test_uuid',
            'test_timestamp',
            'test_boolean',
            'test_jsonb',
            'test_text',
            'test_binary',
            'id'
          ])
        )
      })

      it('should store record with a money field properly', async () => {
        const pg = new PostgresSchemaImportService(conn)

        const log = createFastifyMockLogger()
        const ssId = await pg.importSchema(user.id, log)

        snapshotMocks.push(ssId)

        const changeRequestId = randomUUID()

        const changeIdOne = randomUUID()

        const recordIdOne = randomUUID()

        const changeRequest = changeRequestMock.create({
          id: changeRequestId,
          connection_id: conn.id,
          database_name: 'sort_xyz',
          created_by: user.id
        })
        await ChangeRequestService.createChangeRequest({
          ...changeRequest,
          labels: [],
          reviewers: [],
          changes: []
        })

        const changeOne = changeMock.create({
          id: changeIdOne,
          action: 'DELETE',
          change_request_id: changeRequestId,
          connection_id: conn.id,
          metadata_database_name: 'sort_xyz',
          metadata_schema_name: 'test',
          metadata_table_name: 'change_request_test_unsupported_types'
        })
        await ChangeService.insertChange(getDb(), changeOne)

        await testTableUnsupportedTypesMock.insert(
          testTableUnsupportedTypesMock.create({
            id: recordIdOne,
            test_money: '$100.00'
          })
        )

        const primaryKeysOne = [
          {
            id: randomUUID(),
            change_id: changeIdOne,
            column_name: 'id',
            string_value: undefined,
            numeric_value: undefined,
            date_value: undefined,
            boolean_value: undefined,
            json_value: undefined,
            uuid_value: recordIdOne
          } satisfies ChangePrimaryKey
        ]
        await ChangeService.insertChangePrimaryKey(getDb(), primaryKeysOne[0])

        await getDb()
          .transaction()
          .execute(async trx => {
            await storePreviousChanges({
              trx,
              changes: [
                {
                  ...changeOne,
                  primary_keys: primaryKeysOne,
                  fields: [],
                  previous_fields: []
                }
              ]
            })
          })

        const result = await getDb()
          .selectFrom('change_previous_field_value')
          .where('change_id', '=', changeIdOne)
          .selectAll()
          .execute()

        expect(result).toHaveLength(22)

        expect(result.map(r => r.column_name)).toEqual(
          expect.arrayContaining(['test_money', 'id'])
        )

        const moneyRow = result.find(r => r.column_name === 'test_money')
        expect(moneyRow?.numeric_value).toEqual('100.00')
      })
    })

    describe('#getFieldValues', () => {
      it('supports null values', async () => {
        const change = {
          id: '234',
          change_request_id: '123',
          index: 3,
          connection_id: '123',
          metadata_database_name: 'sort_xyz',
          metadata_schema_name: 'test',
          metadata_table_name: 'change_request_test',
          action: 'ADD' as const,
          fields: [],
          primary_keys: [],
          previous_fields: []
        }

        const strVal = 'this is my string'
        const uuidVal = randomUUID()
        const boolVal = true
        const jsonVal = '{ "test": "test" }'
        const dateVal = '2024-06-17T22:30:00.689Z'
        const numVal = 808

        const row = [
          strVal,
          null,
          uuidVal,
          null,
          boolVal,
          null,
          jsonVal,
          null,
          dateVal,
          null,
          numVal,
          null
        ]
        const columns = [
          {
            type: 'string',
            name: 'my_string'
          },
          {
            type: 'string',
            name: 'my_null_string'
          },
          {
            type: 'uuid',
            name: 'my_uuid'
          },
          {
            type: 'uuid',
            name: 'my_null_uuid'
          },
          {
            type: 'boolean',
            name: 'my_boolean'
          },
          {
            type: 'boolean',
            name: 'my_null_boolean'
          },
          {
            type: 'json',
            name: 'my_json'
          },
          {
            type: 'json',
            name: 'my_null_json'
          },
          {
            type: 'date',
            name: 'my_date'
          },
          {
            type: 'date',
            name: 'my_null_date'
          },
          {
            type: 'numeric',
            name: 'my_numeric'
          },
          {
            type: 'numeric',
            name: 'my_null_numeric'
          }
        ] satisfies QueryColumn[]

        const expectations = [
          {
            id: expect.stringMatching(uuidFormat),
            change_id: change.id,
            column_name: 'my_string',
            is_value_null: false,
            string_value: strVal,
            numeric_value: undefined,
            date_value: undefined,
            boolean_value: undefined,
            json_value: undefined,
            uuid_value: undefined
          },
          {
            id: expect.stringMatching(uuidFormat),
            change_id: change.id,
            column_name: 'my_null_string',
            is_value_null: true,
            string_value: null,
            numeric_value: undefined,
            date_value: undefined,
            boolean_value: undefined,
            json_value: undefined,
            uuid_value: undefined
          },
          {
            id: expect.stringMatching(uuidFormat),
            change_id: change.id,
            column_name: 'my_uuid',
            is_value_null: false,
            string_value: undefined,
            numeric_value: undefined,
            date_value: undefined,
            boolean_value: undefined,
            json_value: undefined,
            uuid_value: uuidVal
          },
          {
            id: expect.stringMatching(uuidFormat),
            change_id: change.id,
            column_name: 'my_null_uuid',
            is_value_null: true,
            string_value: undefined,
            numeric_value: undefined,
            date_value: undefined,
            boolean_value: undefined,
            json_value: undefined,
            uuid_value: null
          },
          {
            id: expect.stringMatching(uuidFormat),
            change_id: change.id,
            column_name: 'my_boolean',
            is_value_null: false,
            string_value: undefined,
            numeric_value: undefined,
            date_value: undefined,
            boolean_value: boolVal,
            json_value: undefined,
            uuid_value: undefined
          },
          {
            id: expect.stringMatching(uuidFormat),
            change_id: change.id,
            column_name: 'my_null_boolean',
            is_value_null: true,
            string_value: undefined,
            numeric_value: undefined,
            date_value: undefined,
            boolean_value: null,
            json_value: undefined,
            uuid_value: undefined
          },
          {
            id: expect.stringMatching(uuidFormat),
            change_id: change.id,
            column_name: 'my_json',
            is_value_null: false,
            string_value: undefined,
            numeric_value: undefined,
            date_value: undefined,
            boolean_value: undefined,
            json_value: jsonVal,
            uuid_value: undefined
          },
          {
            id: expect.stringMatching(uuidFormat),
            change_id: change.id,
            column_name: 'my_null_json',
            is_value_null: true,
            string_value: undefined,
            numeric_value: undefined,
            date_value: undefined,
            boolean_value: undefined,
            json_value: null,
            uuid_value: undefined
          },
          {
            id: expect.stringMatching(uuidFormat),
            change_id: change.id,
            column_name: 'my_date',
            is_value_null: false,
            string_value: undefined,
            numeric_value: undefined,
            date_value: expect.any(Date),
            boolean_value: undefined,
            json_value: undefined,
            uuid_value: undefined
          },
          {
            id: expect.stringMatching(uuidFormat),
            change_id: change.id,
            column_name: 'my_null_date',
            is_value_null: true,
            string_value: undefined,
            numeric_value: undefined,
            date_value: null,
            boolean_value: undefined,
            json_value: undefined,
            uuid_value: undefined
          },
          {
            id: expect.stringMatching(uuidFormat),
            change_id: change.id,
            column_name: 'my_numeric',
            is_value_null: false,
            string_value: undefined,
            numeric_value: String(numVal),
            date_value: undefined,
            boolean_value: undefined,
            json_value: undefined,
            uuid_value: undefined
          },
          {
            id: expect.stringMatching(uuidFormat),
            change_id: change.id,
            column_name: 'my_null_numeric',
            is_value_null: true,
            string_value: undefined,
            numeric_value: null,
            date_value: undefined,
            boolean_value: undefined,
            json_value: undefined,
            uuid_value: undefined
          }
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        ].map(o => expect.objectContaining(o))

        for (let i = 0; i < columns.length; i++) {
          const vals = getFieldValues(change, [row[i]], [columns[i]])
          expect(vals).toEqual([expectations[i]])
        }
      })
    })
  })
})
