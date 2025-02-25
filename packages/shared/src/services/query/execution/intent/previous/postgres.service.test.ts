/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { randomUUID } from 'crypto'

import { createKysely, disconnectKysely, getDb } from '../../../../..'
import { ChangeMock } from '../../../../../mocks/change-requests/change.mock'
import { ChangeRequestTestTableMock } from '../../../../../mocks/change-requests/test-table.mock'
import { ConnectionMock } from '../../../../../mocks/connection.mock'
import { createFastifyMockLogger } from '../../../../../mocks/fastify-logger.mock'
import { OrganizationMock } from '../../../../../mocks/org.mock'
import { SnapshotMock } from '../../../../../mocks/snapshot/snapshot.mock'
import { UserMock } from '../../../../../mocks/user.mock'
import * as ConnectionService from '../../../../../services/connection.service'
import * as OrganizationService from '../../../../../services/org.service'
import { PostgresSchemaImportService } from '../../../../../services/schema-import/pg/schema-import.service'
import * as UserService from '../../../../../services/user.service'

import { PostgresPreviousQueryService } from './postgres.service'

import type { ChangePrimaryKey } from '../../../../../schemas/change.schema'
import type * as QueryExecutionSchema from '../../../../../schemas/query-execution.schema'

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('Tests for Postgres Intent Query Execution', () => {
  const userMock = new UserMock()
  const connMock = new ConnectionMock()
  const orgMock = new OrganizationMock()
  const snapshotMocks = new SnapshotMock()
  const changeMock = new ChangeMock()
  const testTableMock = new ChangeRequestTestTableMock()

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
  })

  describe('#postgresPreviousQueryService', () => {
    it('should target one record given one primary key in one change', async () => {
      const pg = new PostgresSchemaImportService(conn)

      const log = createFastifyMockLogger()
      const ssId = await pg.importSchema(user.id, log)

      snapshotMocks.push(ssId)

      const changeId = randomUUID()
      const recordId = randomUUID()
      const primaryKeys = [
        {
          id: randomUUID(),
          change_id: changeId,
          column_name: 'id',
          string_value: undefined,
          numeric_value: undefined,
          date_value: undefined,
          boolean_value: undefined,
          json_value: null,
          uuid_value: recordId
        } satisfies ChangePrimaryKey
      ]

      const change = changeMock.create({
        id: changeId,
        connection_id: conn.id,
        metadata_database_name: 'sort_xyz',
        metadata_schema_name: 'test',
        metadata_table_name: 'change_request_test'
      })

      const intentQuery = {
        type: 'intent',
        intent: {
          dml: 'SELECT',
          schema: 'test',
          table: 'change_request_test',
          columns: [
            'id',
            'test_uuid',
            'test_numeric',
            'test_timestamp',
            'test_boolean',
            'test_jsonb',
            'test_text',
            'test_binary'
          ],
          combinator: 'AND',
          filters: [],
          orders: [{ column: 'id', direction: 'ASC' }],
          limit: 100
        }
      } satisfies QueryExecutionSchema.Query

      const record = testTableMock.create({
        id: recordId,
        test_numeric: '100',
        test_uuid: randomUUID(),
        test_timestamp: new Date(),
        test_boolean: true,
        test_jsonb: { test: 'test' },
        test_text: 'test',
        test_binary: Buffer.from('hello world')
      })
      await testTableMock.insert(record)

      await testTableMock.insert(
        testTableMock.create({
          id: randomUUID(),
          test_numeric: '100',
          test_uuid: randomUUID(),
          test_timestamp: new Date(),
          test_boolean: true,
          test_jsonb: { test: 'test' },
          test_text: 'test',
          test_binary: Buffer.from('hello world')
        })
      )

      const querySvc = new PostgresPreviousQueryService(conn, [
        {
          ...change,
          primary_keys: primaryKeys,
          fields: [],
          previous_fields: []
        }
      ])
      const result = await querySvc.execute('sort_xyz', intentQuery)

      expect(result.records).toHaveLength(1)
      expect(result).toEqual({
        columns: expect.arrayContaining([
          { name: 'id', type: 'uuid' },
          { name: 'test_uuid', type: 'uuid' },
          { name: 'test_numeric', type: 'numeric' },
          { name: 'test_timestamp', type: 'date' },
          { name: 'test_boolean', type: 'boolean' },
          { name: 'test_jsonb', type: 'json' },
          { name: 'test_text', type: 'string' },
          { name: 'test_binary', type: 'binary' }
        ]),
        duration_ms: expect.any(Number),
        query: expect.stringMatching(/^.*SELECT.*FROM.*WHERE.*LIMIT.*/gims),
        records: [
          [
            record.id,
            record.test_uuid,
            record.test_numeric,
            record.test_timestamp,
            record.test_boolean,
            record.test_jsonb,
            record.test_text,
            record.test_binary
          ]
        ]
      })
    })

    it('should target one record given two primary keys in one change', async () => {
      const pg = new PostgresSchemaImportService(conn)

      const log = createFastifyMockLogger()
      const ssId = await pg.importSchema(user.id, log)

      snapshotMocks.push(ssId)

      const changeId = randomUUID()
      const primaryKeys = [
        {
          id: randomUUID(),
          change_id: changeId,
          column_name: 'test_text',
          string_value: 'test',
          numeric_value: undefined,
          date_value: undefined,
          boolean_value: undefined,
          json_value: undefined,
          uuid_value: undefined
        } satisfies ChangePrimaryKey,
        {
          id: randomUUID(),
          change_id: changeId,
          column_name: 'test_numeric',
          string_value: undefined,
          numeric_value: '100',
          date_value: undefined,
          boolean_value: undefined,
          json_value: undefined,
          uuid_value: undefined
        } satisfies ChangePrimaryKey
      ]

      const change = changeMock.create({
        id: changeId,
        connection_id: conn.id,
        metadata_database_name: 'sort_xyz',
        metadata_schema_name: 'test',
        metadata_table_name: 'change_request_test'
      })

      const intentQuery = {
        type: 'intent',
        intent: {
          dml: 'SELECT',
          schema: 'test',
          table: 'change_request_test',
          columns: [
            'id',
            'test_uuid',
            'test_numeric',
            'test_timestamp',
            'test_boolean',
            'test_jsonb',
            'test_text',
            'test_binary'
          ],
          combinator: 'AND',
          filters: [],
          orders: [{ column: 'id', direction: 'ASC' }],
          limit: 100
        }
      } satisfies QueryExecutionSchema.Query

      const record = testTableMock.create({
        id: randomUUID(),
        test_numeric: '100',
        test_uuid: randomUUID(),
        test_timestamp: new Date(),
        test_boolean: true,
        test_jsonb: { test: 'test' },
        test_text: 'test',
        test_binary: Buffer.from('hello world')
      })
      await testTableMock.insert(record)

      await testTableMock.insert(
        testTableMock.create({
          id: randomUUID(),
          test_numeric: '103',
          test_uuid: randomUUID(),
          test_timestamp: new Date(),
          test_boolean: true,
          test_jsonb: { test: 'test' },
          test_text: 'test',
          test_binary: Buffer.from('hello world')
        })
      )

      await testTableMock.insert(
        testTableMock.create({
          id: randomUUID(),
          test_numeric: '100',
          test_uuid: randomUUID(),
          test_timestamp: new Date(),
          test_boolean: true,
          test_jsonb: { test: 'test' },
          test_text: 'no_test',
          test_binary: Buffer.from('hello world')
        })
      )

      const querySvc = new PostgresPreviousQueryService(conn, [
        {
          ...change,
          primary_keys: primaryKeys,
          fields: [],
          previous_fields: []
        }
      ])
      const result = await querySvc.execute('sort_xyz', intentQuery)

      expect(result.records).toHaveLength(1)
      expect(result).toEqual({
        columns: expect.arrayContaining([
          { name: 'id', type: 'uuid' },
          { name: 'test_uuid', type: 'uuid' },
          { name: 'test_numeric', type: 'numeric' },
          { name: 'test_timestamp', type: 'date' },
          { name: 'test_boolean', type: 'boolean' },
          { name: 'test_jsonb', type: 'json' },
          { name: 'test_text', type: 'string' },
          { name: 'test_binary', type: 'binary' }
        ]),
        duration_ms: expect.any(Number),
        query: expect.stringMatching(/^.*SELECT.*FROM.*WHERE.*LIMIT.*/gims),
        records: [
          [
            record.id,
            record.test_uuid,
            record.test_numeric,
            record.test_timestamp,
            record.test_boolean,
            record.test_jsonb,
            record.test_text,
            record.test_binary
          ]
        ]
      })
    })

    it('should target two records given one primary key in two changes', async () => {
      const pg = new PostgresSchemaImportService(conn)

      const log = createFastifyMockLogger()
      const ssId = await pg.importSchema(user.id, log)

      snapshotMocks.push(ssId)

      const changeIdOne = randomUUID()
      const changeIdTwo = randomUUID()

      const recordIdOne = randomUUID()
      const recordIdTwo = randomUUID()

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

      const changeOne = changeMock.create({
        id: changeIdOne,
        connection_id: conn.id,
        metadata_database_name: 'sort_xyz',
        metadata_schema_name: 'test',
        metadata_table_name: 'change_request_test'
      })

      const changeTwo = changeMock.create({
        id: changeIdTwo,
        connection_id: conn.id,
        metadata_database_name: 'sort_xyz',
        metadata_schema_name: 'test',
        metadata_table_name: 'change_request_test'
      })

      const intentQuery = {
        type: 'intent',
        intent: {
          dml: 'SELECT',
          schema: 'test',
          table: 'change_request_test',
          columns: [
            'id',
            'test_uuid',
            'test_numeric',
            'test_timestamp',
            'test_boolean',
            'test_jsonb',
            'test_text',
            'test_binary'
          ],
          combinator: 'AND',
          filters: [],
          orders: [{ column: 'id', direction: 'ASC' }],
          limit: 100
        }
      } satisfies QueryExecutionSchema.Query

      const recordOne = testTableMock.create({
        id: recordIdOne,
        test_numeric: '100',
        test_uuid: randomUUID(),
        test_timestamp: new Date(),
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
        test_timestamp: new Date(),
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

      const querySvc = new PostgresPreviousQueryService(conn, [
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
      ])
      const result = await querySvc.execute('sort_xyz', intentQuery)

      expect(result.records).toHaveLength(2)
      expect(result).toEqual({
        columns: expect.arrayContaining([
          { name: 'id', type: 'uuid' },
          { name: 'test_uuid', type: 'uuid' },
          { name: 'test_numeric', type: 'numeric' },
          { name: 'test_timestamp', type: 'date' },
          { name: 'test_boolean', type: 'boolean' },
          { name: 'test_jsonb', type: 'json' },
          { name: 'test_text', type: 'string' },
          { name: 'test_binary', type: 'binary' }
        ]),
        duration_ms: expect.any(Number),
        query: expect.stringMatching(/^.*SELECT.*FROM.*WHERE.*LIMIT.*/gims),
        records: expect.arrayContaining([
          [
            recordOne.id,
            recordOne.test_uuid,
            recordOne.test_numeric,
            recordOne.test_timestamp,
            recordOne.test_boolean,
            recordOne.test_jsonb,
            recordOne.test_text,
            recordOne.test_binary
          ],
          [
            recordTwo.id,
            recordTwo.test_uuid,
            recordTwo.test_numeric,
            recordTwo.test_timestamp,
            recordTwo.test_boolean,
            recordTwo.test_jsonb,
            recordTwo.test_text,
            recordTwo.test_binary
          ]
        ])
      })
    })

    it('should target two records given two primary keys in two changes', async () => {
      const pg = new PostgresSchemaImportService(conn)

      const log = createFastifyMockLogger()
      const ssId = await pg.importSchema(user.id, log)

      snapshotMocks.push(ssId)

      const changeIdOne = randomUUID()
      const changeIdTwo = randomUUID()

      const recordIdOne = randomUUID()
      const recordIdTwo = randomUUID()

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

      const changeOne = changeMock.create({
        id: changeIdOne,
        connection_id: conn.id,
        metadata_database_name: 'sort_xyz',
        metadata_schema_name: 'test',
        metadata_table_name: 'change_request_test'
      })

      const changeTwo = changeMock.create({
        id: changeIdTwo,
        connection_id: conn.id,
        metadata_database_name: 'sort_xyz',
        metadata_schema_name: 'test',
        metadata_table_name: 'change_request_test'
      })

      const intentQuery = {
        type: 'intent',
        intent: {
          dml: 'SELECT',
          schema: 'test',
          table: 'change_request_test',
          columns: [
            'id',
            'test_uuid',
            'test_numeric',
            'test_timestamp',
            'test_boolean',
            'test_jsonb',
            'test_text',
            'test_binary'
          ],
          combinator: 'AND',
          filters: [],
          orders: [{ column: 'id', direction: 'ASC' }],
          limit: 100
        }
      } satisfies QueryExecutionSchema.Query

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

      const querySvc = new PostgresPreviousQueryService(conn, [
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
      ])
      const result = await querySvc.execute('sort_xyz', intentQuery)

      expect(result.records).toHaveLength(2)
      expect(result).toEqual({
        columns: expect.arrayContaining([
          { name: 'id', type: 'uuid' },
          { name: 'test_uuid', type: 'uuid' },
          { name: 'test_numeric', type: 'numeric' },
          { name: 'test_timestamp', type: 'date' },
          { name: 'test_boolean', type: 'boolean' },
          { name: 'test_jsonb', type: 'json' },
          { name: 'test_text', type: 'string' },
          { name: 'test_binary', type: 'binary' }
        ]),
        duration_ms: expect.any(Number),
        query: expect.stringMatching(/^.*SELECT.*FROM.*WHERE.*LIMIT.*/gims),
        records: expect.arrayContaining([
          [
            recordOne.id,
            recordOne.test_uuid,
            recordOne.test_numeric,
            recordOne.test_timestamp,
            recordOne.test_boolean,
            recordOne.test_jsonb,
            recordOne.test_text,
            recordOne.test_binary
          ],
          [
            recordTwo.id,
            recordTwo.test_uuid,
            recordTwo.test_numeric,
            recordTwo.test_timestamp,
            recordTwo.test_boolean,
            recordTwo.test_jsonb,
            recordTwo.test_text,
            recordTwo.test_binary
          ]
        ])
      })
    })
  })
})
