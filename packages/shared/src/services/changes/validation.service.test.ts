import * as ColumnService from '../kysely/snapshot/column.service'
import * as SnapshotService from '../kysely/snapshot/snapshot.service'
import * as TableService from '../kysely/snapshot/table.service'

import { validateFieldValues } from './validation.service'

import type {
  ChangeFieldValueSelect,
  ChangeSelect
} from '../../types/change-request.types'

describe('ValidationService tests', () => {
  describe('#validateFieldValues', () => {
    const change = {
      id: '1',
      action: 'ADD',
      index: 1,
      metadata_database_name: 'test',
      metadata_schema_name: 'test',
      metadata_table_name: 'test',
      change_request_id: '1',
      connection_id: '1'
    } satisfies ChangeSelect

    beforeEach(() => {
      jest.spyOn(SnapshotService, 'getCurrentSnapshot').mockResolvedValueOnce({
        id: '1',
        status: 'RUNNING',
        connection_id: '1',
        creator: 'test',
        timestamp: new Date()
      })
      jest
        .spyOn(TableService, 'getTableFromCurrentSnapshot')
        .mockResolvedValueOnce({
          id: '1',
          is_view: false,
          name: 'test',
          schema_id: '1'
        })
      jest.spyOn(ColumnService, 'getColumnsByTableId').mockResolvedValueOnce([
        {
          id: '1',
          name: 'test',
          is_primary_key: false,
          nullable: false,
          position: 1,
          type: 'test',
          table_id: '1',
          has_default: false
        }
      ])
    })

    it('should do nothing when passed fields are matched to stored columns that do exist', async () => {
      const fields = [
        {
          change_id: '1',
          column_name: 'test',
          string_value: 'test',
          id: '1',
          date_value: null,
          numeric_value: null,
          boolean_value: null,
          uuid_value: null,
          is_value_null: false,
          json_value: null,
          binary_value: null
        } satisfies ChangeFieldValueSelect
      ]

      const connectionId = '1'
      const databaseName = 'test'

      const validation = validateFieldValues({
        change,
        connectionId,
        databaseName,
        fields
      })
      await expect(validation).resolves.toEqual(void 0)
    })

    it('should throw an error when passed fields are not matched to stored columns', async () => {
      const fields = [
        {
          change_id: '1',
          column_name: 'fail_test',
          string_value: 'test',
          id: '1',
          date_value: null,
          numeric_value: null,
          boolean_value: null,
          is_value_null: false,
          json_value: null,
          uuid_value: null,
          binary_value: null
        } satisfies ChangeFieldValueSelect
      ]

      const connectionId = '1'
      const databaseName = 'test'

      const validation = validateFieldValues({
        change,
        connectionId,
        databaseName,
        fields
      })

      await expect(validation).rejects.toThrow('column "fail_test" not found')
    })
  })
})
