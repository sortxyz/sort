import { randomUUID } from 'crypto'

import { logger, getConfig, createKysely, disconnectKysely } from '../..'
import * as ChangeService from '../changes/change.service'
import * as ValidationService from '../changes/validation.service'
import * as SnapshotColumnService from '../kysely/snapshot/column.service'
import * as SnapshotTableService from '../kysely/snapshot/table.service'

import { KyselyExtractor } from './kysely-extractor.service'

import type {
  ChangeFieldValueSelect,
  ChangePrimaryKeySelect,
  ChangeRequestSelect,
  ChangeSelect
} from '../../types/change-request.types'
import type { SortDB } from '../../types/kysely.type'
import type { Kysely } from 'kysely'

describe('kysely-extractor tests', () => {
  let kyselyDb: Kysely<SortDB>
  let mockChangeRequest: ChangeRequestSelect

  beforeAll(() => {
    kyselyDb = createKysely({ config: getConfig(), sortLogger: logger })

    mockChangeRequest = {
      id: randomUUID(),
      metadata_database_connection_id: randomUUID(),
      metadata_database_raw_name: 'sort_xyz',
      change_request_number: 1,
      status: 'open',
      created_at: new Date(),
      created_by: '123',
      title: 'test',
      description: 'test',
      updated_at: new Date()
    } satisfies ChangeRequestSelect
  })

  beforeEach(() => {
    jest.spyOn(ValidationService, 'validateFieldValues').mockResolvedValue()
  })

  afterAll(async () => {
    await disconnectKysely()
  })

  describe('#extractSQL', () => {
    it('should extract SQL from an DELETE change with one primary key reference', async () => {
      const changeId = randomUUID()

      jest
        .spyOn(ChangeService, 'getPrimaryKeysForChange')
        .mockResolvedValueOnce([
          {
            id: randomUUID(),
            change_id: changeId,
            column_name: 'id',
            string_value: '123',
            numeric_value: null,
            date_value: null,
            boolean_value: null,
            json_value: null,
            uuid_value: null,
            binary_value: null
          } satisfies ChangePrimaryKeySelect
        ])

      const changes = [
        {
          id: changeId,
          metadata_database_name: 'sort_xyz',
          metadata_schema_name: 'test',
          metadata_table_name: 'change_request_test',
          action: 'DELETE',
          change_request_id: '123',
          connection_id: '4456',
          index: 1
        } satisfies ChangeSelect
      ]

      const extractor = new KyselyExtractor(mockChangeRequest, changes)
      await extractor.setupChanges()
      const extracted = extractor.extractSQL()
      const compiledSql = extracted[0].statement.compile(kyselyDb)

      expect(compiledSql.sql).toEqual(
        'DELETE FROM "sort_xyz"."test"."change_request_test" WHERE "id" = $1;'
      )

      expect(compiledSql.parameters).toEqual(['123'])
    })

    it('should extract SQL from an DELETE change with two primary key reference', async () => {
      const changeId = randomUUID()

      jest
        .spyOn(ChangeService, 'getPrimaryKeysForChange')
        .mockResolvedValueOnce([
          {
            id: randomUUID(),
            change_id: changeId,
            column_name: 'id',
            string_value: null,
            numeric_value: '123',
            date_value: null,
            boolean_value: null,
            json_value: null,
            uuid_value: null,
            binary_value: null
          } satisfies ChangePrimaryKeySelect,
          {
            id: '234',
            change_id: changeId,
            column_name: 'name',
            string_value: 'doe',
            numeric_value: null,
            date_value: null,
            boolean_value: null,
            json_value: null,
            uuid_value: null,
            binary_value: null
          } satisfies ChangePrimaryKeySelect
        ])

      const changes = [
        {
          id: changeId,
          metadata_database_name: 'sort_xyz',
          metadata_schema_name: 'test',
          metadata_table_name: 'change_request_test',
          action: 'DELETE',
          change_request_id: '123',
          connection_id: '4456',
          index: 1
        } satisfies ChangeSelect
      ]

      const extractor = new KyselyExtractor(mockChangeRequest, changes)
      await extractor.setupChanges()
      const extracted = extractor.extractSQL()
      const compiledSql = extracted[0].statement.compile(kyselyDb)

      expect(compiledSql.sql).toEqual(
        'DELETE FROM "sort_xyz"."test"."change_request_test" WHERE "id" = $1 AND "name" = $2;'
      )

      expect(compiledSql.parameters).toEqual(['123', 'doe'])
    })

    it('should extract SQL from an ADD change with one field value', async () => {
      const changeId = randomUUID()

      jest
        .spyOn(SnapshotColumnService, 'getPrimaryKeys')
        .mockResolvedValueOnce([
          {
            id: randomUUID(),
            table_id: randomUUID(),
            name: 'id',
            type: 'uuid',
            nullable: false,
            has_default: false,
            position: 0,
            is_primary_key: true
          }
        ])

      jest
        .spyOn(SnapshotTableService, 'getTableFromCurrentSnapshot')
        .mockResolvedValueOnce({
          id: randomUUID(),
          schema_id: randomUUID(),
          is_view: false,
          name: 'change_request_test'
        })

      jest
        .spyOn(ChangeService, 'getFieldValuesForChange')
        .mockResolvedValueOnce([
          {
            id: '123',
            change_id: changeId,
            column_name: 'id',
            string_value: '123',
            numeric_value: null,
            date_value: null,
            boolean_value: null,
            json_value: null,
            is_value_null: false,
            uuid_value: null,
            binary_value: null
          } satisfies ChangeFieldValueSelect
        ])

      const changes = [
        {
          id: changeId,
          metadata_database_name: 'sort_xyz',
          metadata_schema_name: 'test',
          metadata_table_name: 'change_request_test',
          action: 'ADD',
          change_request_id: '123',
          connection_id: '4456',
          index: 1
        } satisfies ChangeSelect
      ]

      const extractor = new KyselyExtractor(mockChangeRequest, changes)
      await extractor.setupChanges()
      const extracted = extractor.extractSQL()
      const compiledSql = extracted[0].statement.compile(kyselyDb)

      expect(compiledSql.sql).toEqual(
        'INSERT INTO "sort_xyz"."test"."change_request_test" ("id") VALUES ($1) RETURNING "id";'
      )

      expect(compiledSql.parameters).toEqual(['123'])
    })

    it('should extract SQL from an ADD change for all supported column types', async () => {
      const changeId = randomUUID()
      const jsonValue = { hello: ['world'] }
      const dateValue = new Date()

      jest
        .spyOn(SnapshotColumnService, 'getPrimaryKeys')
        .mockResolvedValueOnce([
          {
            id: randomUUID(),
            table_id: randomUUID(),
            name: 'id',
            type: 'uuid',
            nullable: false,
            has_default: false,
            position: 0,
            is_primary_key: true
          },
          {
            id: randomUUID(),
            table_id: randomUUID(),
            name: 'is_value_null',
            type: 'boolean',
            nullable: false,
            has_default: false,
            position: 0,
            is_primary_key: false
          }
        ])

      jest
        .spyOn(SnapshotTableService, 'getTableFromCurrentSnapshot')
        .mockResolvedValueOnce({
          id: randomUUID(),
          schema_id: randomUUID(),
          is_view: false,
          name: 'change_request_test'
        })

      jest
        .spyOn(ChangeService, 'getFieldValuesForChange')
        .mockResolvedValueOnce([
          {
            id: '1',
            change_id: changeId,
            column_name: 'is_value_null',
            string_value: null,
            numeric_value: null,
            date_value: null,
            boolean_value: null,
            json_value: null,
            is_value_null: true,
            uuid_value: null,
            binary_value: null
          } satisfies ChangeFieldValueSelect,
          {
            id: '2',
            change_id: changeId,
            column_name: 'string_value',
            string_value: 'doe',
            numeric_value: null,
            date_value: null,
            boolean_value: null,
            json_value: null,
            is_value_null: false,
            uuid_value: null,
            binary_value: null
          } satisfies ChangeFieldValueSelect,
          {
            id: '2.1',
            change_id: changeId,
            column_name: 'string_value_empty',
            string_value: '',
            numeric_value: null,
            date_value: null,
            boolean_value: null,
            json_value: null,
            is_value_null: false,
            uuid_value: null,
            binary_value: null
          } satisfies ChangeFieldValueSelect,
          {
            id: '3',
            change_id: changeId,
            column_name: 'numeric_value_positive',
            string_value: null,
            numeric_value: '1234567890',
            date_value: null,
            boolean_value: null,
            json_value: null,
            is_value_null: false,
            uuid_value: null,
            binary_value: null
          } satisfies ChangeFieldValueSelect,
          {
            id: '3.1',
            change_id: changeId,
            column_name: 'numeric_value_negative',
            string_value: null,
            numeric_value: '-1234567890',
            date_value: null,
            boolean_value: null,
            json_value: null,
            is_value_null: false,
            uuid_value: null,
            binary_value: null
          } satisfies ChangeFieldValueSelect,
          {
            id: '3.2',
            change_id: changeId,
            column_name: 'numeric_value_zero',
            string_value: null,
            numeric_value: '0',
            date_value: null,
            boolean_value: null,
            json_value: null,
            is_value_null: false,
            uuid_value: null,
            binary_value: null
          } satisfies ChangeFieldValueSelect,
          {
            id: '4',
            change_id: changeId,
            column_name: 'date_value',
            string_value: null,
            numeric_value: null,
            date_value: dateValue,
            boolean_value: null,
            json_value: null,
            is_value_null: false,
            uuid_value: null,
            binary_value: null
          } satisfies ChangeFieldValueSelect,
          {
            id: '5',
            change_id: changeId,
            column_name: 'boolean_value_true',
            string_value: null,
            numeric_value: null,
            date_value: null,
            boolean_value: true,
            json_value: null,
            is_value_null: false,
            uuid_value: null,
            binary_value: null
          } satisfies ChangeFieldValueSelect,
          {
            id: '5.1',
            change_id: changeId,
            column_name: 'boolean_value_false',
            string_value: null,
            numeric_value: null,
            date_value: null,
            boolean_value: false,
            json_value: null,
            is_value_null: false,
            uuid_value: null,
            binary_value: null
          } satisfies ChangeFieldValueSelect,
          {
            id: '6',
            change_id: changeId,
            column_name: 'json_value',
            string_value: null,
            numeric_value: null,
            date_value: null,
            boolean_value: null,
            json_value: jsonValue,
            is_value_null: false,
            uuid_value: null,
            binary_value: null
          } satisfies ChangeFieldValueSelect,
          {
            id: '7',
            change_id: changeId,
            column_name: 'uuid_value',
            string_value: null,
            numeric_value: null,
            date_value: null,
            boolean_value: null,
            json_value: null,
            is_value_null: false,
            uuid_value: '7d1e09f3-cda8-438a-b2dc-b8fa242796a2',
            binary_value: null
          } satisfies ChangeFieldValueSelect
        ])

      const changes = [
        {
          id: changeId,
          metadata_database_name: 'sort_xyz',
          metadata_schema_name: 'test',
          metadata_table_name: 'change_request_test',
          action: 'ADD',
          change_request_id: '123',
          connection_id: '4456',
          index: 1
        } satisfies ChangeSelect
      ]

      const extractor = new KyselyExtractor(mockChangeRequest, changes)
      await extractor.setupChanges()
      const extracted = extractor.extractSQL()
      const compiledSql = extracted[0].statement.compile(kyselyDb)

      expect(compiledSql.sql).toEqual(
        'INSERT INTO "sort_xyz"."test"."change_request_test" ("is_value_null", "string_value", "string_value_empty", "numeric_value_positive", "numeric_value_negative", "numeric_value_zero", "date_value", "boolean_value_true", "boolean_value_false", "json_value", "uuid_value") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING "id", "is_value_null";'
      )

      expect(compiledSql.parameters).toEqual([
        null,
        'doe',
        '',
        '1234567890',
        '-1234567890',
        '0',
        dateValue,
        'TRUE',
        'FALSE',
        JSON.stringify(jsonValue),
        '7d1e09f3-cda8-438a-b2dc-b8fa242796a2'
      ])
    })

    it('should extract SQL from an UPDATE change with one field value, one primary key reference', async () => {
      const changeId = randomUUID()

      jest
        .spyOn(ChangeService, 'getFieldValuesForChange')
        .mockResolvedValueOnce([
          {
            id: '123',
            change_id: changeId,
            column_name: 'name',
            string_value: 'doe',
            numeric_value: null,
            date_value: null,
            boolean_value: null,
            json_value: null,
            is_value_null: false,
            uuid_value: null,
            binary_value: null
          } satisfies ChangeFieldValueSelect
        ])

      jest
        .spyOn(ChangeService, 'getPrimaryKeysForChange')
        .mockResolvedValueOnce([
          {
            id: '234',
            change_id: changeId,
            column_name: 'id',
            string_value: '123',
            numeric_value: null,
            date_value: null,
            boolean_value: null,
            json_value: null,
            uuid_value: null,
            binary_value: null
          } satisfies ChangePrimaryKeySelect
        ])

      const changes = [
        {
          id: changeId,
          metadata_database_name: 'sort_xyz',
          metadata_schema_name: 'test',
          metadata_table_name: 'change_request_test',
          action: 'MODIFY',
          change_request_id: '123',
          connection_id: '4456',
          index: 1
        } satisfies ChangeSelect
      ]

      const extractor = new KyselyExtractor(mockChangeRequest, changes)
      await extractor.setupChanges()
      const extracted = extractor.extractSQL()
      const compiledSql = extracted[0].statement.compile(kyselyDb)

      expect(compiledSql.sql).toEqual(
        'UPDATE "sort_xyz"."test"."change_request_test" SET "name" = $1 WHERE "id" = $2;'
      )

      expect(compiledSql.parameters).toEqual(['doe', '123'])
    })

    it('should extract SQL from an UPDATE change with for all supported column types', async () => {
      const changeId = randomUUID()
      const jsonValue = { hello: ['world'] }
      const dateValue = new Date()

      jest
        .spyOn(ChangeService, 'getFieldValuesForChange')
        .mockResolvedValueOnce([
          {
            id: '1',
            change_id: changeId,
            column_name: 'is_value_null',
            string_value: null,
            numeric_value: null,
            date_value: null,
            boolean_value: null,
            json_value: null,
            is_value_null: true,
            uuid_value: null,
            binary_value: null
          } satisfies ChangeFieldValueSelect,
          {
            id: '2',
            change_id: changeId,
            column_name: 'string_value',
            string_value: 'doe',
            numeric_value: null,
            date_value: null,
            boolean_value: null,
            json_value: null,
            is_value_null: false,
            uuid_value: null,
            binary_value: null
          } satisfies ChangeFieldValueSelect,
          {
            id: '2.1',
            change_id: changeId,
            column_name: 'string_value_empty',
            string_value: '',
            numeric_value: null,
            date_value: null,
            boolean_value: null,
            json_value: null,
            is_value_null: false,
            uuid_value: null,
            binary_value: null
          } satisfies ChangeFieldValueSelect,
          {
            id: '3',
            change_id: changeId,
            column_name: 'numeric_value_positive',
            string_value: null,
            numeric_value: '1234567890',
            date_value: null,
            boolean_value: null,
            json_value: null,
            is_value_null: false,
            uuid_value: null,
            binary_value: null
          } satisfies ChangeFieldValueSelect,
          {
            id: '3.1',
            change_id: changeId,
            column_name: 'numeric_value_negative',
            string_value: null,
            numeric_value: '-1234567890',
            date_value: null,
            boolean_value: null,
            json_value: null,
            is_value_null: false,
            uuid_value: null,
            binary_value: null
          } satisfies ChangeFieldValueSelect,
          {
            id: '3.2',
            change_id: changeId,
            column_name: 'numeric_value_zero',
            string_value: null,
            numeric_value: '0',
            date_value: null,
            boolean_value: null,
            json_value: null,
            is_value_null: false,
            uuid_value: null,
            binary_value: null
          } satisfies ChangeFieldValueSelect,
          {
            id: '4',
            change_id: changeId,
            column_name: 'date_value',
            string_value: null,
            numeric_value: null,
            date_value: dateValue,
            boolean_value: null,
            json_value: null,
            is_value_null: false,
            uuid_value: null,
            binary_value: null
          } satisfies ChangeFieldValueSelect,
          {
            id: '5',
            change_id: changeId,
            column_name: 'boolean_value_true',
            string_value: null,
            numeric_value: null,
            date_value: null,
            boolean_value: true,
            json_value: null,
            is_value_null: false,
            uuid_value: null,
            binary_value: null
          } satisfies ChangeFieldValueSelect,
          {
            id: '5.1',
            change_id: changeId,
            column_name: 'boolean_value_false',
            string_value: null,
            numeric_value: null,
            date_value: null,
            boolean_value: false,
            json_value: null,
            is_value_null: false,
            uuid_value: null,
            binary_value: null
          } satisfies ChangeFieldValueSelect,
          {
            id: '6',
            change_id: changeId,
            column_name: 'json_value',
            string_value: null,
            numeric_value: null,
            date_value: null,
            boolean_value: null,
            json_value: jsonValue,
            is_value_null: false,
            uuid_value: null,
            binary_value: null
          } satisfies ChangeFieldValueSelect,
          {
            id: '7',
            change_id: changeId,
            column_name: 'uuid_value',
            string_value: null,
            numeric_value: null,
            date_value: null,
            boolean_value: null,
            json_value: null,
            is_value_null: false,
            uuid_value: '7d1e09f3-cda8-438a-b2dc-b8fa242796a2',
            binary_value: null
          } satisfies ChangeFieldValueSelect,
          {
            id: '8',
            change_id: changeId,
            column_name: 'test_binary',
            string_value: null,
            numeric_value: null,
            date_value: null,
            boolean_value: null,
            json_value: null,
            is_value_null: false,
            uuid_value: null,
            binary_value: Buffer.from('hello world')
          } satisfies ChangeFieldValueSelect
        ])

      jest
        .spyOn(ChangeService, 'getPrimaryKeysForChange')
        .mockResolvedValueOnce([
          {
            id: '234',
            change_id: changeId,
            column_name: 'id',
            string_value: '123',
            numeric_value: null,
            date_value: null,
            boolean_value: null,
            json_value: null,
            uuid_value: null,
            binary_value: null
          } satisfies ChangePrimaryKeySelect,
          {
            id: '345',
            change_id: changeId,
            column_name: 'email',
            string_value: 'doe@example.com',
            numeric_value: null,
            date_value: null,
            boolean_value: null,
            json_value: null,
            uuid_value: null,
            binary_value: null
          } satisfies ChangePrimaryKeySelect
        ])

      const changes = [
        {
          id: changeId,
          metadata_database_name: 'sort_xyz',
          metadata_schema_name: 'test',
          metadata_table_name: 'change_request_test',
          action: 'MODIFY',
          change_request_id: '123',
          connection_id: '4456',
          index: 1
        } satisfies ChangeSelect
      ]

      const extractor = new KyselyExtractor(mockChangeRequest, changes)
      await extractor.setupChanges()
      const extracted = extractor.extractSQL()
      const compiledSql = extracted[0].statement.compile(kyselyDb)

      expect(compiledSql.sql).toEqual(
        'UPDATE "sort_xyz"."test"."change_request_test" SET "is_value_null" = $1, "string_value" = $2, "string_value_empty" = $3, "numeric_value_positive" = $4, "numeric_value_negative" = $5, "numeric_value_zero" = $6, "date_value" = $7, "boolean_value_true" = $8, "boolean_value_false" = $9, "json_value" = $10, "uuid_value" = $11, "test_binary" = $12 WHERE "id" = $13 AND "email" = $14;'
      )

      expect(compiledSql.parameters).toEqual([
        null,
        'doe',
        '',
        '1234567890',
        '-1234567890',
        '0',
        dateValue,
        'TRUE',
        'FALSE',
        JSON.stringify(jsonValue),
        '7d1e09f3-cda8-438a-b2dc-b8fa242796a2',
        Buffer.from('hello world').toString('base64'),
        '123',
        'doe@example.com'
      ])
    })

    it('should extract SQL from an ADD, UPDATE, DELETE changes with for all supported column types', async () => {
      const jsonValue = { hello: ['world'] }
      const dateValue = new Date()

      const changes: ChangeSelect[] = []

      for (const action of ['ADD', 'MODIFY', 'DELETE'] as const) {
        const changeId = randomUUID()

        jest
          .spyOn(SnapshotColumnService, 'getPrimaryKeys')
          .mockResolvedValueOnce([
            {
              id: randomUUID(),
              table_id: randomUUID(),
              name: 'id',
              type: 'uuid',
              nullable: false,
              has_default: false,
              position: 0,
              is_primary_key: true
            }
          ])

        jest
          .spyOn(SnapshotTableService, 'getTableFromCurrentSnapshot')
          .mockResolvedValueOnce({
            id: randomUUID(),
            schema_id: randomUUID(),
            is_view: false,
            name: 'change_request_test'
          })

        jest
          .spyOn(ChangeService, 'getFieldValuesForChange')
          .mockResolvedValueOnce([
            {
              id: '1',
              change_id: changeId,
              column_name: 'is_value_null',
              string_value: null,
              numeric_value: null,
              date_value: null,
              boolean_value: null,
              json_value: null,
              is_value_null: true,
              uuid_value: null,
              binary_value: null
            } satisfies ChangeFieldValueSelect,
            {
              id: '2',
              change_id: changeId,
              column_name: 'string_value',
              string_value: 'doe',
              numeric_value: null,
              date_value: null,
              boolean_value: null,
              json_value: null,
              is_value_null: false,
              uuid_value: null,
              binary_value: null
            } satisfies ChangeFieldValueSelect,
            {
              id: '2.1',
              change_id: changeId,
              column_name: 'string_value_empty',
              string_value: '',
              numeric_value: null,
              date_value: null,
              boolean_value: null,
              json_value: null,
              is_value_null: false,
              uuid_value: null,
              binary_value: null
            } satisfies ChangeFieldValueSelect,
            {
              id: '3',
              change_id: changeId,
              column_name: 'numeric_value_positive',
              string_value: null,
              numeric_value: '1234567890',
              date_value: null,
              boolean_value: null,
              json_value: null,
              is_value_null: false,
              uuid_value: null,
              binary_value: null
            } satisfies ChangeFieldValueSelect,
            {
              id: '3.1',
              change_id: changeId,
              column_name: 'numeric_value_negative',
              string_value: null,
              numeric_value: '-1234567890',
              date_value: null,
              boolean_value: null,
              json_value: null,
              is_value_null: false,
              uuid_value: null,
              binary_value: null
            } satisfies ChangeFieldValueSelect,
            {
              id: '3.2',
              change_id: changeId,
              column_name: 'numeric_value_zero',
              string_value: null,
              numeric_value: '0',
              date_value: null,
              boolean_value: null,
              json_value: null,
              is_value_null: false,
              uuid_value: null,
              binary_value: null
            } satisfies ChangeFieldValueSelect,
            {
              id: '4',
              change_id: changeId,
              column_name: 'date_value',
              string_value: null,
              numeric_value: null,
              date_value: dateValue,
              boolean_value: null,
              json_value: null,
              is_value_null: false,
              uuid_value: null,
              binary_value: null
            } satisfies ChangeFieldValueSelect,
            {
              id: '5',
              change_id: changeId,
              column_name: 'boolean_value_true',
              string_value: null,
              numeric_value: null,
              date_value: null,
              boolean_value: true,
              json_value: null,
              is_value_null: false,
              uuid_value: null,
              binary_value: null
            } satisfies ChangeFieldValueSelect,
            {
              id: '5.1',
              change_id: changeId,
              column_name: 'boolean_value_false',
              string_value: null,
              numeric_value: null,
              date_value: null,
              boolean_value: false,
              json_value: null,
              is_value_null: false,
              uuid_value: null,
              binary_value: null
            } satisfies ChangeFieldValueSelect,
            {
              id: '6',
              change_id: changeId,
              column_name: 'json_value',
              string_value: null,
              numeric_value: null,
              date_value: null,
              boolean_value: null,
              json_value: jsonValue,
              is_value_null: false,
              uuid_value: null,
              binary_value: null
            } satisfies ChangeFieldValueSelect,
            {
              id: '7',
              change_id: changeId,
              column_name: 'uuid_value',
              string_value: null,
              numeric_value: null,
              date_value: null,
              boolean_value: null,
              json_value: null,
              is_value_null: false,
              uuid_value: '7d1e09f3-cda8-438a-b2dc-b8fa242796a2',
              binary_value: null
            } satisfies ChangeFieldValueSelect
          ])

        jest.spyOn(ChangeService, 'getPrimaryKeysForChange').mockResolvedValue([
          {
            id: '234',
            change_id: changeId,
            column_name: 'id',
            string_value: '123',
            numeric_value: null,
            date_value: null,
            boolean_value: null,
            json_value: null,
            uuid_value: null,
            binary_value: null
          } satisfies ChangePrimaryKeySelect,
          {
            id: '345',
            change_id: changeId,
            column_name: 'email',
            string_value: 'doe@example.com',
            numeric_value: null,
            date_value: null,
            boolean_value: null,
            json_value: null,
            uuid_value: null,
            binary_value: null
          } satisfies ChangePrimaryKeySelect
        ])

        changes.push({
          id: changeId,
          metadata_database_name: 'sort_xyz',
          metadata_schema_name: 'test',
          metadata_table_name: 'change_request_test',
          action,
          change_request_id: '123',
          connection_id: '4456',
          index: 1
        } satisfies ChangeSelect)
      }

      const extractor = new KyselyExtractor(mockChangeRequest, changes)
      await extractor.setupChanges()
      const extracted = extractor.extractSQL()

      const compiledSql = extracted[0].statement.compile(kyselyDb)
      expect(compiledSql.sql).toEqual(
        'INSERT INTO "sort_xyz"."test"."change_request_test" ("is_value_null", "string_value", "string_value_empty", "numeric_value_positive", "numeric_value_negative", "numeric_value_zero", "date_value", "boolean_value_true", "boolean_value_false", "json_value", "uuid_value") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING "id";'
      )
      expect(compiledSql.parameters).toEqual([
        null,
        'doe',
        '',
        '1234567890',
        '-1234567890',
        '0',
        dateValue,
        'TRUE',
        'FALSE',
        JSON.stringify(jsonValue),
        '7d1e09f3-cda8-438a-b2dc-b8fa242796a2'
      ])

      const compiledSqlOne = extracted[1].statement.compile(kyselyDb)
      expect(compiledSqlOne.sql).toEqual(
        'UPDATE "sort_xyz"."test"."change_request_test" SET "is_value_null" = $1, "string_value" = $2, "string_value_empty" = $3, "numeric_value_positive" = $4, "numeric_value_negative" = $5, "numeric_value_zero" = $6, "date_value" = $7, "boolean_value_true" = $8, "boolean_value_false" = $9, "json_value" = $10, "uuid_value" = $11 WHERE "id" = $12 AND "email" = $13;'
      )
      expect(compiledSqlOne.parameters).toEqual([
        null,
        'doe',
        '',
        '1234567890',
        '-1234567890',
        '0',
        dateValue,
        'TRUE',
        'FALSE',
        JSON.stringify(jsonValue),
        '7d1e09f3-cda8-438a-b2dc-b8fa242796a2',
        '123',
        'doe@example.com'
      ])

      const compiledSqlTwo = extracted[2].statement.compile(kyselyDb)
      expect(compiledSqlTwo.sql).toEqual(
        'DELETE FROM "sort_xyz"."test"."change_request_test" WHERE "id" = $1 AND "email" = $2;'
      )
      expect(compiledSqlTwo.parameters).toEqual(['123', 'doe@example.com'])
    })
  })
})
