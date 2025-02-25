import { NonNullableNonGeneratedFieldError } from '../../errors'
import { DuplicateColumnNameError } from '../../errors/change-requests/duplicates.error'
import {
  PrimaryKeyDoesNotExistError,
  PrimaryKeyMatchError
} from '../../errors/change-requests/primary-keys.error'
import { NotFoundError } from '../../errors/not-found.error'
import {
  getColumnsByTableId,
  getPrimaryKeys
} from '../kysely/snapshot/column.service'
import { getTableFromCurrentSnapshot } from '../kysely/snapshot/table.service'

import type {
  ChangePrimaryKeyBody,
  RequestChangeFieldValue
} from '../../schemas/change.schema'
import type {
  ChangeFieldValueSelect,
  ChangeSelect
} from '../../types/change-request.types'

export const validateNoDuplicates = (fields: { column_name: string }[]) => {
  const fieldNames = fields.map(field => field.column_name)
  const uniqueFieldNames = new Set(fieldNames)

  if (fieldNames.length !== uniqueFieldNames.size) {
    const duplicates = fieldNames.filter(
      (name, index) => fieldNames.indexOf(name) !== index
    )
    throw new DuplicateColumnNameError(duplicates)
  }
}

/**
 * Validates that fields passed in a change request are not nullable or undefined for columns they are targetting.
 */
export const validateNonNullFieldsForInsert = async ({
  change,
  connectionId,
  databaseName,
  fields,
  payloadIndex
}: {
  change: ChangeSelect
  connectionId: string
  databaseName: string
  fields: RequestChangeFieldValue[]
  payloadIndex?: number
}) => {
  const table = await getTableFromCurrentSnapshot(
    connectionId,
    databaseName,
    change.metadata_schema_name,
    change.metadata_table_name
  )

  if (!table) {
    throw new NotFoundError('table')
  }

  const storedColumns = await getColumnsByTableId(table.id)

  for (const col of storedColumns) {
    // if a column is not nullable and doesn't have a default, we can't allow nulls to be passed
    if (col && !col.nullable && !col.has_default) {
      const field = fields.find(field => field.column_name === col.name)
      if (!field || field.value === null || field.value === undefined) {
        throw new NonNullableNonGeneratedFieldError(col.name, {
          cause: {
            change,
            field,
            payloadIndex
          }
        })
      }
    }
  }
}

export const validatePrimaryKeys = async ({
  change,
  connectionId,
  databaseName,
  keys
}: {
  change: ChangeSelect
  connectionId: string
  databaseName: string
  keys: ChangePrimaryKeyBody[]
}) => {
  const table = await getTableFromCurrentSnapshot(
    connectionId,
    databaseName,
    change.metadata_schema_name,
    change.metadata_table_name
  )

  if (!table) {
    throw new NotFoundError('table')
  }

  const tablePrimaryKeys = await getPrimaryKeys(table.id)

  // ensure passed primary keys are in the table's primary keys 1:1
  const tablePrimaryKeyNames = tablePrimaryKeys.map(key => key.name)
  const passedPrimaryKeyNames = keys.map(key => key.column_name)

  if (tablePrimaryKeys.length !== keys.length) {
    throw new PrimaryKeyMatchError(change.id, change.change_request_id)
  }

  for (const passedPrimaryKeyName of passedPrimaryKeyNames) {
    if (!tablePrimaryKeyNames.includes(passedPrimaryKeyName)) {
      throw new PrimaryKeyDoesNotExistError(passedPrimaryKeyName, table.name)
    }
  }
}

export const validateFieldValues = async ({
  change,
  databaseName,
  connectionId,
  fields
}: {
  change: ChangeSelect
  databaseName: string
  connectionId: string
  fields: ChangeFieldValueSelect[]
}) => {
  const table = await getTableFromCurrentSnapshot(
    connectionId,
    databaseName,
    change.metadata_schema_name,
    change.metadata_table_name
  )
  if (!table) {
    throw new NotFoundError('table')
  }

  const cols = await getColumnsByTableId(table.id)

  const columnNames = cols.map(col => col.name)
  const passedColumnNames = fields.map(field => field.column_name)

  for (const passedColumnName of passedColumnNames) {
    if (!columnNames.includes(passedColumnName)) {
      throw new NotFoundError('column', {
        changeId: change.id,
        missingColumnName: passedColumnName,
        changeRequestId: change.change_request_id
      })
    }
  }
}
