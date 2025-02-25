import { randomUUID } from 'crypto'

import { getReverseProviderColumnMappings } from '../../utils/column-mapping.util'
import { EncryptedField } from '../../utils/crypt.util'
import * as ConnectionService from '../connection.service'
import * as SnapshotColumnService from '../kysely/snapshot/column.service'
import * as SnapshotService from '../kysely/snapshot/snapshot.service'
import * as SnapshotTableService from '../kysely/snapshot/table.service'

import * as ChangeBuilderService from './change-builder.service'
import * as ChangeService from './change.service'
import * as PreviousChangeService from './previous-change.service'
import * as ValidationService from './validation.service'

import type {
  RequestChangeFieldValue,
  RequestChange
} from '../../schemas/change.schema'
import type { ColumnSelect } from '../../types/kysely/snapshot/column.type'
import type { SortDB } from '../../types/kysely.type'
import type { Transaction } from 'kysely'

describe('Change Builder Service tests', () => {
  const fixedDate = new Date('2024-01-01T00:00:00Z')
  const fixedUuid = randomUUID()

  beforeEach(() => {
    jest.spyOn(ConnectionService, 'getById').mockResolvedValue({
      id: randomUUID(),
      name: 'connection',
      data_provider: 'postgres',
      connection_string: EncryptedField.fromDecryptedValue('connection_string'),
      created_at: new Date(),
      created_by: randomUUID(),
      organization_id: randomUUID(),
      with_ssl: false,
      visibility: 'private',
      readonly_connection_id: null,
      warehouse: null
    })
  })

  describe('#checkFieldValue', () => {
    it('should throw an error if column is not nullable and null value is passed', () => {
      const colMappings = getReverseProviderColumnMappings('postgres')

      const column = {
        type: 'string',
        name: 'name',
        table_id: randomUUID(),
        nullable: false,
        position: 0,
        id: randomUUID(),
        is_primary_key: false,
        has_default: false
      } satisfies ColumnSelect

      const field = {
        column_name: 'name',
        value: null
      } satisfies RequestChangeFieldValue

      const change = {
        table_name: 'user',
        schema_name: 'public',
        action: 'ADD',
        fields: [field]
      } satisfies RequestChange

      expect(() =>
        ChangeBuilderService.checkFieldValue({
          column,
          field,
          columnMappings: colMappings,
          change
        })
      ).toThrow('Column "name" cannot be null.')
    })

    it('should throw if another column type is passed', () => {
      const colMappings = getReverseProviderColumnMappings('postgres')

      const column = {
        type: 'binary',
        name: 'name',
        table_id: randomUUID(),
        nullable: false,
        position: 0,
        id: randomUUID(),
        is_primary_key: false,
        has_default: false
      } satisfies ColumnSelect

      const field = {
        column_name: 'name',
        value: '123'
      } satisfies RequestChangeFieldValue

      const change = {
        table_name: 'user',
        schema_name: 'public',
        action: 'ADD',
        fields: [field]
      } satisfies RequestChange

      expect(() =>
        ChangeBuilderService.checkFieldValue({
          column,
          field,
          columnMappings: colMappings,
          change
        })
      ).toThrow('Unknown column type')
    })

    describe.each([
      ['int8', /Invalid value for:/, 'numeric', false, 4444, 4444],
      ['int4', /Invalid value for:/, 'numeric', false, '4444', '4444'],
      ['money', /Invalid value for:/, 'numeric', false, 4444.44, 4444.44],
      ['bool', /Invalid value for:/, 'boolean', 'nope', true, true],
      ['text', /Invalid value for:/, 'string', false, 'hello', 'hello'],
      [
        'timestamp',
        /Invalid value for:/,
        'date',
        'nope',
        fixedDate.toUTCString(),
        fixedDate
      ],
      ['uuid', /Invalid value for:/, 'uuid', 'nope', fixedUuid, fixedUuid],
      [
        'jsonb',
        /Invalid value for:/,
        'json',
        '{"nope: true',
        JSON.stringify({}),
        JSON.stringify({})
      ]
    ])(
      'column type %s',
      (colType, errorRegExp, expectedFieldType, bad, good, goodExpected) => {
        it('should validate a valid value', () => {
          const colMappings = getReverseProviderColumnMappings('postgres')

          const column = {
            type: colType,
            name: 'name',
            table_id: randomUUID(),
            nullable: true,
            position: 0,
            id: randomUUID(),
            is_primary_key: false,
            has_default: false
          } satisfies ColumnSelect

          const field = {
            column_name: 'name',
            value: good
          } satisfies RequestChangeFieldValue

          const change = {
            table_name: 'user',
            schema_name: 'public',
            action: 'ADD',
            fields: [field]
          } satisfies RequestChange

          const value = ChangeBuilderService.checkFieldValue({
            column,
            field,
            columnMappings: colMappings,
            change
          })

          expect(value).toEqual({
            valueFieldName: `${expectedFieldType}_value`,
            valueField: goodExpected
          })
        })

        it('should throw on invalid values', () => {
          const colMappings = getReverseProviderColumnMappings('postgres')

          const column = {
            type: colType,
            name: 'name',
            table_id: randomUUID(),
            nullable: true,
            position: 0,
            id: randomUUID(),
            is_primary_key: false,
            has_default: false
          } satisfies ColumnSelect

          const field = {
            column_name: 'name',
            value: bad
          } satisfies RequestChangeFieldValue

          const change = {
            table_name: 'user',
            schema_name: 'public',
            action: 'ADD',
            fields: [field]
          } satisfies RequestChange

          expect(() =>
            ChangeBuilderService.checkFieldValue({
              column,
              field,
              columnMappings: colMappings,
              change
            })
          ).toThrow(errorRegExp)
        })

        it('should have the expected field type', () => {
          const colMappings = getReverseProviderColumnMappings('postgres')

          const column = {
            type: colType,
            name: 'name',
            table_id: randomUUID(),
            nullable: true,
            position: 0,
            id: randomUUID(),
            is_primary_key: false,
            has_default: false
          } satisfies ColumnSelect

          const field = {
            column_name: 'name',
            value: null
          } satisfies RequestChangeFieldValue

          const change = {
            table_name: 'user',
            schema_name: 'public',
            action: 'MODIFY',
            fields: [field],
            primary_keys: [{ column_name: 'id', value: randomUUID() }]
          } satisfies RequestChange

          const value = ChangeBuilderService.checkFieldValue({
            column,
            field,
            columnMappings: colMappings,
            change
          })

          expect(value).toEqual({
            valueFieldName: `${expectedFieldType}_value`,
            valueField: null
          })
        })
      }
    )
  })

  describe('#makeBaseRow', () => {
    it('should error if column is not found', () => {
      const column = {
        type: 'numeric',
        name: 'name',
        table_id: randomUUID(),
        nullable: false,
        position: 0,
        id: randomUUID(),
        is_primary_key: false,
        has_default: false
      } satisfies ColumnSelect

      const columns = [column]

      const field = {
        column_name: 'some_other_name',
        value: '123'
      } satisfies RequestChangeFieldValue

      const change = {
        table_name: 'user',
        schema_name: 'public',
        action: 'MODIFY',
        fields: [field],
        primary_keys: [{ column_name: 'id', value: randomUUID() }]
      } satisfies RequestChange

      expect(() =>
        ChangeBuilderService.makeBaseRow({
          dataProvider: 'postgres',
          field,
          columns,
          change
        })
      ).toThrow('column "some_other_name" not found')
    })
  })

  describe('#fieldToRow', () => {
    it('should map field to a row', () => {
      const column = {
        type: 'numeric',
        name: 'quantity',
        table_id: randomUUID(),
        nullable: false,
        position: 0,
        id: randomUUID(),
        is_primary_key: false,
        has_default: false
      } satisfies ColumnSelect

      const columns = [column]

      const field = {
        column_name: 'quantity',
        value: 123
      } satisfies RequestChangeFieldValue

      const change = {
        table_name: 'user',
        schema_name: 'public',
        action: 'MODIFY',
        fields: [field],
        primary_keys: [{ column_name: 'id', value: randomUUID() }]
      } satisfies RequestChange

      const result = ChangeBuilderService.fieldToRow({
        changeId: '12345',
        dataProvider: 'postgres',
        field,
        columns,
        change
      })

      expect(result).toEqual({
        change_id: '12345',
        id: expect.any(String),
        is_value_null: false,
        column_name: 'quantity',
        numeric_value: 123
      })
    })
  })

  describe('#pkeyToRow', () => {
    it('should map pkey to a row', () => {
      const column = {
        type: 'numeric',
        name: 'quantity',
        table_id: randomUUID(),
        nullable: false,
        position: 0,
        id: randomUUID(),
        is_primary_key: false,
        has_default: false
      } satisfies ColumnSelect

      const columns = [column]

      const field = {
        column_name: 'quantity',
        value: 123
      } satisfies RequestChangeFieldValue

      const change = {
        table_name: 'user',
        schema_name: 'public',
        action: 'MODIFY',
        fields: [field],
        primary_keys: [{ column_name: 'id', value: randomUUID() }]
      } satisfies RequestChange

      const result = ChangeBuilderService.pkeyToRow({
        changeId: '123',
        dataProvider: 'postgres',
        field,
        columns,
        change
      })

      expect(result).toEqual({
        change_id: '123',
        id: expect.any(String),
        column_name: 'quantity',
        numeric_value: 123
      })
    })
  })

  describe('#getColumnsFromChangeRows', () => {
    it('should get columns from change rows', async () => {
      const tableId = randomUUID()
      jest
        .spyOn(SnapshotTableService, 'getTableFromCurrentSnapshot')
        .mockResolvedValue({
          id: tableId,
          schema_id: randomUUID(),
          is_view: false,
          name: 'table'
        })

      jest
        .spyOn(SnapshotColumnService, 'getColumnsByTableId')
        .mockResolvedValue([
          {
            id: randomUUID(),
            name: 'name',
            table_id: tableId,
            type: 'text',
            position: 0,
            nullable: false,
            is_primary_key: false,
            has_default: false
          }
        ])

      jest.spyOn(SnapshotService, 'getCurrentSnapshot').mockResolvedValue({
        id: randomUUID(),
        connection_id: randomUUID(),
        timestamp: new Date(),
        creator: randomUUID(),
        status: 'COMPLETED'
      })

      const columns = await ChangeBuilderService.getColumnsFromChangeRows(
        [
          {
            table_name: 'table',
            schema_name: 'public'
          }
        ],
        '123123123123',
        'postgres'
      )

      expect(columns).toEqual(
        new Map([
          [
            'public.table',
            [
              {
                id: expect.any(String),
                name: 'name',
                table_id: tableId,
                type: 'text',
                position: 0,
                nullable: false,
                is_primary_key: false,
                has_default: false
              }
            ]
          ]
        ])
      )
    })
  })

  describe('#buildChangesFromRows', () => {
    it('should build changes from rows for ADD action', async () => {
      jest
        .spyOn(ChangeBuilderService, 'getColumnsFromChangeRows')
        .mockResolvedValue(
          new Map([
            [
              'public.table',
              [
                {
                  id: expect.any(String),
                  name: 'is_active',
                  table_id: expect.any(String),
                  type: 'bool',
                  position: 0,
                  nullable: false,
                  is_primary_key: false,
                  has_default: false
                }
              ]
            ]
          ])
        )

      const original = {
        action: 'ADD',
        schema_name: 'public',
        table_name: 'table',
        fields: [
          {
            column_name: 'is_active',
            value: true
          }
        ]
      } satisfies RequestChange

      const result = await ChangeBuilderService.buildRowsFromChanges(
        '123',
        [original],
        '123',
        'postgres'
      )

      expect(result).toEqual([
        {
          change: {
            id: expect.any(String),
            action: 'ADD',
            connection_id: expect.any(String),
            metadata_database_name: 'postgres',
            metadata_schema_name: 'public',
            metadata_table_name: 'table',
            change_request_id: '123',
            index: 0
          },
          original,
          fields: [
            {
              change_id: expect.any(String),
              id: expect.any(String),
              is_value_null: false,
              column_name: 'is_active',
              boolean_value: true
            }
          ],
          keys: []
        }
      ])
    })

    it('should build changes from rows for MODIFY action', async () => {
      jest
        .spyOn(ChangeBuilderService, 'getColumnsFromChangeRows')
        .mockResolvedValue(
          new Map([
            [
              'public.table',
              [
                {
                  id: randomUUID(),
                  name: 'json',
                  table_id: randomUUID(),
                  type: 'json',
                  position: 0,
                  nullable: false,
                  is_primary_key: false,
                  has_default: false
                },
                {
                  id: randomUUID(),
                  name: 'id',
                  table_id: randomUUID(),
                  type: 'uuid',
                  position: 0,
                  nullable: false,
                  is_primary_key: false,
                  has_default: false
                }
              ]
            ]
          ])
        )

      const primaryKeyId = randomUUID()
      const original = {
        table_name: 'table',
        action: 'MODIFY',
        schema_name: 'public',
        fields: [
          {
            column_name: 'json',
            value: '{"key": "value"}'
          }
        ],
        primary_keys: [
          {
            column_name: 'id',
            value: primaryKeyId
          }
        ]
      } satisfies RequestChange

      const result = await ChangeBuilderService.buildRowsFromChanges(
        '123',
        [original],
        '123',
        'postgres'
      )

      expect(result).toEqual([
        {
          change: {
            id: expect.any(String),
            action: 'MODIFY',
            connection_id: expect.any(String),
            metadata_database_name: 'postgres',
            metadata_schema_name: 'public',
            metadata_table_name: 'table',
            change_request_id: '123',
            index: 0
          },
          original,
          fields: [
            {
              change_id: expect.any(String),
              id: expect.any(String),
              is_value_null: false,
              column_name: 'json',
              json_value: '{"key": "value"}'
            }
          ],
          keys: [
            {
              change_id: expect.any(String),
              id: expect.any(String),
              column_name: 'id',
              uuid_value: primaryKeyId
            }
          ]
        }
      ])
    })

    it('should build changes from rows for DELETE action', async () => {
      jest
        .spyOn(ChangeBuilderService, 'getColumnsFromChangeRows')
        .mockResolvedValue(
          new Map([
            [
              'public.table',
              [
                {
                  id: randomUUID(),
                  name: 'name',
                  table_id: randomUUID(),
                  type: 'numeric',
                  position: 0,
                  nullable: false,
                  is_primary_key: false,
                  has_default: false
                },
                {
                  id: randomUUID(),
                  name: 'id',
                  table_id: randomUUID(),
                  type: 'uuid',
                  position: 0,
                  nullable: false,
                  is_primary_key: false,
                  has_default: false
                }
              ]
            ]
          ])
        )

      const primaryKeyId = randomUUID()
      const original = {
        table_name: 'table',
        action: 'DELETE',
        schema_name: 'public',
        primary_keys: [
          {
            column_name: 'id',
            value: primaryKeyId
          }
        ]
      } satisfies RequestChange

      const result = await ChangeBuilderService.buildRowsFromChanges(
        '123',
        [original],
        '123',
        'postgres'
      )

      expect(result).toEqual([
        {
          change: {
            id: expect.any(String),
            action: 'DELETE',
            connection_id: expect.any(String),
            metadata_database_name: 'postgres',
            metadata_schema_name: 'public',
            metadata_table_name: 'table',
            change_request_id: '123',
            index: 0
          },
          original,
          fields: [],
          keys: [
            {
              change_id: expect.any(String),
              id: expect.any(String),
              column_name: 'id',
              uuid_value: primaryKeyId
            }
          ]
        }
      ])
    })

    it('should build changes from rows for ADD action for columns that will get marked DEFAULT', async () => {
      jest
        .spyOn(ChangeBuilderService, 'getColumnsFromChangeRows')
        .mockResolvedValue(
          new Map([
            [
              'public.table',
              [
                {
                  id: expect.any(String),
                  name: 'name',
                  table_id: expect.any(String),
                  type: 'numeric',
                  position: 0,
                  nullable: false,
                  is_primary_key: false,
                  has_default: false
                },
                {
                  id: expect.any(String),
                  name: 'id',
                  table_id: expect.any(String),
                  type: 'uuid',
                  position: 0,
                  nullable: false,
                  is_primary_key: true,
                  has_default: false
                }
              ]
            ]
          ])
        )

      const original = {
        table_name: 'table',
        action: 'ADD',
        schema_name: 'public',
        fields: [
          {
            column_name: 'name',
            value: 123.456
          }
        ]
      } satisfies RequestChange

      const result = await ChangeBuilderService.buildRowsFromChanges(
        '123',
        [original],
        '123',
        'postgres'
      )

      expect(result).toEqual([
        {
          change: {
            id: expect.any(String),
            action: 'ADD',
            connection_id: expect.any(String),
            metadata_database_name: 'postgres',
            metadata_schema_name: 'public',
            metadata_table_name: 'table',
            change_request_id: '123',
            index: 0
          },
          original,
          fields: [
            {
              change_id: expect.any(String),
              id: expect.any(String),
              is_value_null: false,
              column_name: 'name',
              numeric_value: 123.456
            }
          ],
          keys: []
        }
      ])
    })
  })

  describe('#createChanges', () => {
    it('should not validate duplicate keys or primary keys if there are none', async () => {
      jest
        .spyOn(ChangeBuilderService, 'buildRowsFromChanges')
        .mockResolvedValue([
          {
            change: {
              id: expect.any(String),
              action: 'ADD',
              connection_id: expect.any(String),
              metadata_database_name: 'postgres',
              metadata_schema_name: 'public',
              metadata_table_name: 'table',
              change_request_id: '123',
              index: 0
            },
            fields: [],
            keys: [],
            original: {
              action: 'ADD',
              schema_name: 'public',
              table_name: 'table',
              fields: []
            }
          }
        ])

      jest
        .spyOn(ChangeService, 'insertChangeWithValues')
        .mockResolvedValueOnce({
          id: randomUUID(),
          action: 'ADD',
          connection_id: randomUUID(),
          metadata_database_name: 'postgres',
          metadata_schema_name: 'public',
          metadata_table_name: 'table',
          change_request_id: '123',
          index: 0
        })

      jest
        .spyOn(PreviousChangeService, 'storePreviousChanges')
        .mockResolvedValueOnce()

      const validateNoDuplicatesSpy = jest
        .spyOn(ValidationService, 'validateNoDuplicates')
        .mockReturnValueOnce()

      const validateNonNullFieldsSpy = jest
        .spyOn(ValidationService, 'validateNonNullFieldsForInsert')
        .mockResolvedValueOnce()

      const validatePrimaryKeysSpy = jest
        .spyOn(ValidationService, 'validatePrimaryKeys')
        .mockResolvedValueOnce()

      await ChangeBuilderService.createChanges(
        {} as unknown as Transaction<SortDB>,
        '123',
        '123',
        '123',
        []
      )

      expect(validateNoDuplicatesSpy).toHaveBeenCalledTimes(0)
      expect(validatePrimaryKeysSpy).toHaveBeenCalledTimes(0)
      expect(validateNonNullFieldsSpy).toHaveBeenCalledTimes(1)
    })

    it('should not validate fields if there are none', async () => {
      jest
        .spyOn(ChangeBuilderService, 'buildRowsFromChanges')
        .mockResolvedValue([
          {
            change: {
              id: expect.any(String),
              action: 'ADD',
              connection_id: expect.any(String),
              metadata_database_name: 'postgres',
              metadata_schema_name: 'public',
              metadata_table_name: 'table',
              change_request_id: '123',
              index: 0
            },
            fields: [],
            keys: [],
            original: {
              action: 'ADD',
              schema_name: 'public',
              table_name: 'table',
              fields: []
            }
          }
        ])

      jest
        .spyOn(ChangeService, 'insertChangeWithValues')
        .mockResolvedValueOnce({
          id: randomUUID(),
          change_request_id: '123',
          index: 0,
          action: 'ADD',
          connection_id: randomUUID(),
          metadata_database_name: 'postgres',
          metadata_table_name: 'table',
          metadata_schema_name: 'public'
        })

      jest
        .spyOn(PreviousChangeService, 'storePreviousChanges')
        .mockResolvedValueOnce()

      const validateNoDuplicatesSpy = jest
        .spyOn(ValidationService, 'validateNoDuplicates')
        .mockReturnValueOnce()

      jest
        .spyOn(ValidationService, 'validateNonNullFieldsForInsert')
        .mockResolvedValueOnce()

      await ChangeBuilderService.createChanges(
        {} as unknown as Transaction<SortDB>,
        '123',
        '123',
        '123',
        []
      )

      expect(validateNoDuplicatesSpy).toHaveBeenCalledTimes(0)
    })
  })
})
