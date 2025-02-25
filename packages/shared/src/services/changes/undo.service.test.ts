import { randomUUID } from 'node:crypto'

import * as Bootstrap from '../..'
import * as SnapshotTableService from '../kysely/snapshot/table.service'

import * as ChangeService from './change.service'
import { UndoChangesService } from './undo.service'

describe('UndoChangesService', () => {
  describe('#setup', () => {
    it('should not be able to be run twice', async () => {
      jest.spyOn(Bootstrap, 'getDb').mockResolvedValue({} as never)

      jest
        .spyOn(ChangeService, 'getPreviousFieldValuesForChange')
        .mockResolvedValue([
          {
            id: randomUUID(),
            change_id: randomUUID(),
            column_name: 'name',
            string_value: 'doe',
            numeric_value: null,
            date_value: null,
            boolean_value: null,
            json_value: null,
            is_value_null: false,
            uuid_value: null,
            binary_value: null
          }
        ])

      jest
        .spyOn(ChangeService, 'getPreviousPrimaryKeysForChange')
        .mockResolvedValue([
          {
            id: randomUUID(),
            change_id: randomUUID(),
            column_name: 'name',
            string_value: 'doe',
            numeric_value: null,
            date_value: null,
            boolean_value: null,
            json_value: null,
            uuid_value: null,
            binary_value: null
          }
        ])

      jest.spyOn(SnapshotTableService, 'getAllColumns').mockResolvedValue([
        {
          id: randomUUID(),
          table_id: randomUUID(),
          name: 'name',
          type: 'string',
          nullable: false,
          has_default: false,
          position: 0,
          is_primary_key: true
        }
      ])

      const undoChanges = new UndoChangesService([
        {
          id: randomUUID(),
          change_request_id: randomUUID(),
          action: 'ADD',
          schema_name: 'schema',
          table_name: 'table',
          database_name: 'db',
          index: 0,
          fields: [
            {
              column_name: 'name',
              type: 'string',
              value: 'doe'
            }
          ]
        }
      ])

      await undoChanges.generateUndoChanges()

      await expect(undoChanges.generateUndoChanges()).rejects.toThrow(
        'Cannot undo changes twice'
      )
    })
  })

  describe('#generateUndoChanges', () => {
    describe('for ADD changes', () => {
      it('should not generate any change for non-ADD changes', async () => {
        const undoChanges = new UndoChangesService([])
        const change = {
          id: randomUUID(),
          change_request_id: randomUUID(),
          action: 'MODIFY',
          schema_name: 'schema',
          table_name: 'table',
          database_name: 'db',
          index: 0,
          fields: [],
          previous_fields: [],
          primary_keys: []
        }
        // @ts-expect-error - this is a private method
        await expect(undoChanges.undoAddChange(change)).rejects.toThrow(
          'Unknown change action'
        )
      })

      it('should throw for 0 captured primary keys', async () => {
        jest.spyOn(Bootstrap, 'getDb').mockResolvedValue({} as never)

        jest
          .spyOn(ChangeService, 'getPreviousFieldValuesForChange')
          .mockResolvedValue([])

        jest
          .spyOn(ChangeService, 'getPreviousPrimaryKeysForChange')
          .mockResolvedValue([])

        jest.spyOn(SnapshotTableService, 'getAllColumns').mockResolvedValue([
          {
            name: 'uuid1',
            type: 'uuid',
            nullable: false,
            table_id: randomUUID(),
            is_primary_key: false,
            has_default: false,
            position: 0,
            id: randomUUID()
          },
          {
            name: 'number1',
            type: 'numeric',
            nullable: false,
            table_id: randomUUID(),
            is_primary_key: true,
            has_default: true,
            position: 1,
            id: randomUUID()
          }
        ])

        const undoChanges = new UndoChangesService([
          {
            id: randomUUID(),
            change_request_id: randomUUID(),
            action: 'ADD',
            schema_name: 'schema',
            table_name: 'table',
            database_name: 'db',
            index: 0,
            fields: [
              {
                column_name: 'uuid1',
                type: 'uuid',
                value: 'uuid1'
              },
              {
                column_name: 'number1',
                type: 'numeric',
                value: '200'
              }
            ]
          }
        ])

        await expect(undoChanges.generateUndoChanges()).rejects.toThrow(
          'Could not find primary keys for change'
        )
      })

      it('should generate DELETE changes', async () => {
        jest.spyOn(Bootstrap, 'getDb').mockResolvedValue({} as never)

        jest
          .spyOn(ChangeService, 'getPreviousFieldValuesForChange')
          .mockResolvedValue([])

        jest
          .spyOn(ChangeService, 'getPreviousPrimaryKeysForChange')
          .mockResolvedValue([
            {
              id: randomUUID(),
              change_id: randomUUID(),
              column_name: 'uuid1',
              string_value: null,
              numeric_value: null,
              date_value: null,
              boolean_value: null,
              json_value: null,
              uuid_value: 'uuid1',
              binary_value: null
            }
          ])

        jest.spyOn(SnapshotTableService, 'getAllColumns').mockResolvedValue([
          {
            name: 'uuid1',
            type: 'uuid',
            nullable: false,
            table_id: randomUUID(),
            is_primary_key: false,
            has_default: false,
            position: 0,
            id: randomUUID()
          },
          {
            name: 'number1',
            type: 'numeric',
            nullable: false,
            table_id: randomUUID(),
            is_primary_key: true,
            has_default: true,
            position: 1,
            id: randomUUID()
          }
        ])

        const undoChanges = new UndoChangesService([
          {
            id: randomUUID(),
            change_request_id: randomUUID(),
            action: 'ADD',
            schema_name: 'schema',
            table_name: 'table',
            database_name: 'db',
            index: 0,
            fields: [
              {
                column_name: 'uuid1',
                type: 'uuid',
                value: 'uuid1'
              },
              {
                column_name: 'number1',
                type: 'numeric',
                value: '200'
              }
            ]
          }
        ])

        const undoChangesResponse = await undoChanges.generateUndoChanges()

        expect(undoChangesResponse).toEqual([
          {
            action: 'DELETE',
            primary_keys: [
              {
                column_name: 'uuid1',
                type: 'uuid',
                value: 'uuid1'
              }
            ],
            schema_name: 'schema',
            table_name: 'table'
          }
        ])
      })
    })

    describe('for DELETE changes', () => {
      it('should not generate any change for non-DELETE changes', async () => {
        const undoChanges = new UndoChangesService([])
        const change = {
          id: randomUUID(),
          change_request_id: randomUUID(),
          action: 'MODIFY',
          schema_name: 'schema',
          table_name: 'table',
          database_name: 'db',
          index: 0,
          fields: [],
          previous_fields: [],
          primary_keys: []
        }
        // @ts-expect-error - this is a private method
        await expect(undoChanges.undoDeleteChange(change)).rejects.toThrow(
          'Unknown change action'
        )
      })

      it('should throw for 0 previous field values', async () => {
        jest.spyOn(Bootstrap, 'getDb').mockResolvedValue({} as never)

        jest
          .spyOn(ChangeService, 'getPreviousFieldValuesForChange')
          .mockResolvedValue([])

        jest
          .spyOn(ChangeService, 'getPreviousPrimaryKeysForChange')
          .mockResolvedValue([])

        jest.spyOn(SnapshotTableService, 'getAllColumns').mockResolvedValue([
          {
            name: 'name1',
            type: 'string',
            nullable: false,
            table_id: randomUUID(),
            is_primary_key: false,
            has_default: false,
            position: 0,
            id: randomUUID()
          },
          {
            name: 'number1',
            type: 'numeric',
            nullable: false,
            table_id: randomUUID(),
            is_primary_key: true,
            has_default: true,
            position: 0,
            id: randomUUID()
          }
        ])

        const undoChanges = new UndoChangesService([
          {
            id: randomUUID(),
            change_request_id: randomUUID(),
            action: 'DELETE',
            schema_name: 'schema',
            table_name: 'table',
            database_name: 'db',
            index: 0,
            previous_fields: [
              {
                type: 'string',
                column_name: 'name1',
                value: 'test1'
              },
              {
                type: 'numeric',
                column_name: 'number1',
                value: '200'
              }
            ],
            primary_keys: [
              {
                type: 'numeric',
                value: '200',
                column_name: 'number1'
              }
            ]
          }
        ])

        await expect(undoChanges.generateUndoChanges()).rejects.toThrow(
          'Could not find previous field values for change'
        )
      })

      it('should generate ADD changes, with stripped primary keys that generate by default', async () => {
        jest.spyOn(Bootstrap, 'getDb').mockResolvedValue({} as never)

        jest
          .spyOn(ChangeService, 'getPreviousFieldValuesForChange')
          .mockResolvedValue([
            {
              id: randomUUID(),
              change_id: randomUUID(),
              column_name: 'name1',
              string_value: 'test1',
              numeric_value: null,
              date_value: null,
              boolean_value: null,
              json_value: null,
              is_value_null: false,
              uuid_value: null,
              binary_value: null
            },
            {
              id: randomUUID(),
              change_id: randomUUID(),
              column_name: 'number1',
              string_value: null,
              numeric_value: '200',
              date_value: null,
              boolean_value: null,
              json_value: null,
              is_value_null: false,
              uuid_value: null,
              binary_value: null
            }
          ])

        jest
          .spyOn(ChangeService, 'getPreviousPrimaryKeysForChange')
          .mockResolvedValue([])

        const undoChanges = new UndoChangesService([
          {
            id: randomUUID(),
            change_request_id: randomUUID(),
            action: 'DELETE',
            schema_name: 'schema',
            table_name: 'table',
            database_name: 'db',
            index: 0,
            previous_fields: [
              {
                type: 'string',
                column_name: 'name1',
                value: 'test1'
              },
              {
                type: 'numeric',
                column_name: 'number1',
                value: '200'
              }
            ],
            primary_keys: [
              {
                type: 'numeric',
                value: '200',
                column_name: 'number1'
              }
            ]
          }
        ])

        const undoChangesResponse = await undoChanges.generateUndoChanges()

        expect(undoChangesResponse).toEqual([
          {
            action: 'ADD',
            fields: [
              {
                column_name: 'name1',
                type: 'string',
                value: 'test1'
              },
              {
                column_name: 'number1',
                type: 'numeric',
                value: '200'
              }
            ],
            schema_name: 'schema',
            table_name: 'table'
          }
        ])
      })
    })

    describe('for MODIFY changes', () => {
      it('should not generate any change for non-MODIFY changes', async () => {
        const undoChanges = new UndoChangesService([])
        const change = {
          id: randomUUID(),
          change_request_id: randomUUID(),
          action: 'DELETE',
          schema_name: 'schema',
          table_name: 'table',
          database_name: 'db',
          index: 0,
          fields: [],
          previous_fields: [],
          primary_keys: []
        }
        // @ts-expect-error - this is a private method
        await expect(undoChanges.undoModifyChange(change)).rejects.toThrow(
          'Unknown change action'
        )
      })

      it('should throw if no previous field values', async () => {
        jest.spyOn(Bootstrap, 'getDb').mockResolvedValue({} as never)

        jest
          .spyOn(ChangeService, 'getPreviousFieldValuesForChange')
          .mockResolvedValue([])

        jest
          .spyOn(ChangeService, 'getPreviousPrimaryKeysForChange')
          .mockResolvedValue([
            {
              id: randomUUID(),
              change_id: randomUUID(),
              column_name: 'uuid1',
              string_value: null,
              numeric_value: null,
              date_value: null,
              boolean_value: null,
              json_value: null,
              uuid_value: 'uuid1',
              binary_value: null
            }
          ])

        const undoChanges = new UndoChangesService([
          {
            id: randomUUID(),
            change_request_id: randomUUID(),
            action: 'MODIFY',
            schema_name: 'schema',
            table_name: 'table',
            database_name: 'db',
            index: 0,
            previous_fields: [
              {
                type: 'string',
                column_name: 'string1',
                value: 'string1'
              },
              {
                type: 'numeric',
                column_name: 'numeric1',
                value: '100'
              }
            ],
            fields: [
              {
                column_name: 'string1',
                type: 'string',
                value: 'string2'
              },
              {
                column_name: 'numeric1',
                type: 'numeric',
                value: '200'
              }
            ],
            primary_keys: [
              {
                column_name: 'uuid1',
                type: 'uuid',
                value: 'uuid1'
              }
            ]
          }
        ])

        await expect(undoChanges.generateUndoChanges()).rejects.toThrow(
          'Could not find previous field values for change'
        )
      })

      it('should throw if no previous primary keys', async () => {
        jest.spyOn(Bootstrap, 'getDb').mockResolvedValue({} as never)

        jest
          .spyOn(ChangeService, 'getPreviousFieldValuesForChange')
          .mockResolvedValue([
            {
              id: randomUUID(),
              change_id: randomUUID(),
              column_name: 'string1',
              string_value: 'string1',
              numeric_value: null,
              date_value: null,
              boolean_value: null,
              json_value: null,
              uuid_value: null,
              binary_value: null,
              is_value_null: false
            },
            {
              id: randomUUID(),
              change_id: randomUUID(),
              column_name: 'numeric1',
              string_value: null,
              numeric_value: '100',
              date_value: null,
              boolean_value: null,
              json_value: null,
              uuid_value: null,
              binary_value: null,
              is_value_null: false
            }
          ])

        jest
          .spyOn(ChangeService, 'getPreviousPrimaryKeysForChange')
          .mockResolvedValue([
            {
              id: randomUUID(),
              change_id: randomUUID(),
              column_name: 'uuid1',
              string_value: null,
              numeric_value: null,
              date_value: null,
              boolean_value: null,
              json_value: null,
              uuid_value: 'uuid1',
              binary_value: null
            }
          ])

        const undoChanges = new UndoChangesService([
          {
            id: randomUUID(),
            change_request_id: randomUUID(),
            action: 'MODIFY',
            schema_name: 'schema',
            table_name: 'table',
            database_name: 'db',
            index: 0,
            previous_fields: [
              {
                type: 'string',
                column_name: 'string1',
                value: 'string1'
              },
              {
                type: 'numeric',
                column_name: 'numeric1',
                value: '100'
              }
            ],
            fields: [
              {
                column_name: 'string1',
                type: 'string',
                value: 'string2'
              },
              {
                column_name: 'numeric1',
                type: 'numeric',
                value: '200'
              }
            ],
            primary_keys: []
          }
        ])

        await expect(undoChanges.generateUndoChanges()).rejects.toThrow(
          'Could not find primary keys for change'
        )
      })

      it('should throw if no retrieved columns contain previous fields for reversion (updated snapshot)', async () => {
        jest.spyOn(Bootstrap, 'getDb').mockResolvedValue({} as never)

        jest
          .spyOn(ChangeService, 'getPreviousFieldValuesForChange')
          .mockResolvedValue([
            {
              id: randomUUID(),
              change_id: randomUUID(),
              column_name: 'string1',
              string_value: 'string1',
              numeric_value: null,
              date_value: null,
              boolean_value: null,
              json_value: null,
              uuid_value: null,
              binary_value: null,
              is_value_null: false
            }
          ])

        jest
          .spyOn(ChangeService, 'getPreviousPrimaryKeysForChange')
          .mockResolvedValue([
            {
              id: randomUUID(),
              change_id: randomUUID(),
              column_name: 'uuid1',
              string_value: null,
              numeric_value: null,
              date_value: null,
              boolean_value: null,
              json_value: null,
              uuid_value: 'uuid1',
              binary_value: null
            }
          ])

        const undoChanges = new UndoChangesService([
          {
            id: 'random-uuid',
            change_request_id: randomUUID(),
            action: 'MODIFY',
            schema_name: 'schema',
            table_name: 'table',
            database_name: 'db',
            index: 0,
            previous_fields: [
              {
                type: 'string',
                column_name: 'string1',
                value: 'string1'
              },
              {
                type: 'numeric',
                column_name: 'numeric1',
                value: '100'
              }
            ],
            fields: [
              {
                column_name: 'string1',
                type: 'string',
                value: 'string2'
              },
              {
                column_name: 'numeric1',
                type: 'numeric',
                value: '200'
              }
            ],
            primary_keys: [
              {
                column_name: 'uuid1',
                type: 'uuid',
                value: 'uuid1'
              }
            ]
          }
        ])

        await expect(undoChanges.generateUndoChanges()).rejects.toThrow(
          'Could not find field numeric1 in change random-uuid'
        )
      })

      it('should generate a MODIFY change with the previous fields', async () => {
        jest.spyOn(Bootstrap, 'getDb').mockResolvedValue({} as never)

        jest
          .spyOn(ChangeService, 'getPreviousFieldValuesForChange')
          .mockResolvedValue([
            {
              id: randomUUID(),
              change_id: randomUUID(),
              column_name: 'string1',
              string_value: 'string1',
              numeric_value: null,
              date_value: null,
              boolean_value: null,
              json_value: null,
              uuid_value: null,
              binary_value: null,
              is_value_null: false
            },
            {
              id: randomUUID(),
              change_id: randomUUID(),
              column_name: 'numeric1',
              string_value: null,
              numeric_value: '100',
              date_value: null,
              boolean_value: null,
              json_value: null,
              uuid_value: null,
              binary_value: null,
              is_value_null: false
            }
          ])

        jest
          .spyOn(ChangeService, 'getPreviousPrimaryKeysForChange')
          .mockResolvedValue([
            {
              id: randomUUID(),
              change_id: randomUUID(),
              column_name: 'uuid1',
              string_value: null,
              numeric_value: null,
              date_value: null,
              boolean_value: null,
              json_value: null,
              uuid_value: 'uuid1',
              binary_value: null
            }
          ])

        const undoChanges = new UndoChangesService([
          {
            id: randomUUID(),
            change_request_id: randomUUID(),
            action: 'MODIFY',
            schema_name: 'schema',
            table_name: 'table',
            database_name: 'db',
            index: 0,
            previous_fields: [
              {
                type: 'string',
                column_name: 'string1',
                value: 'string1'
              },
              {
                type: 'numeric',
                column_name: 'numeric1',
                value: '100'
              }
            ],
            fields: [
              {
                column_name: 'string1',
                type: 'string',
                value: 'string2'
              },
              {
                column_name: 'numeric1',
                type: 'numeric',
                value: '200'
              }
            ],
            primary_keys: [
              {
                column_name: 'uuid1',
                type: 'uuid',
                value: 'uuid1'
              }
            ]
          }
        ])

        const undoChangesResponse = await undoChanges.generateUndoChanges()

        expect(undoChangesResponse).toEqual([
          {
            action: 'MODIFY',
            primary_keys: [
              {
                column_name: 'uuid1',
                type: 'uuid',
                value: 'uuid1'
              }
            ],
            fields: [
              {
                column_name: 'string1',
                type: 'string',
                value: 'string1'
              },
              {
                column_name: 'numeric1',
                type: 'numeric',
                value: '100'
              }
            ],
            schema_name: 'schema',
            table_name: 'table'
          }
        ])
      })
    })
  })
})
