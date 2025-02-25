import { randomUUID } from 'crypto'

import { uuidFormat } from '../../constants/type-mask.constant'
import { RowMissingError } from '../../errors/change-requests/row-missing.error'
import {
  TypeColumnMismatchError,
  UnknownColumnTypeError
} from '../../errors/change-requests/unknown.error'
import { NotFoundError } from '../../errors/not-found.error'
import { toJSONB } from '../../utils/kysely.util'
import { getById } from '../connection.service'
import { getColumnsByTableId } from '../kysely/snapshot/column.service'
import { getTableFromCurrentSnapshot } from '../kysely/snapshot/table.service'
import { getColumn } from '../query/column-type.util'
import { PostgresPreviousQueryService } from '../query/execution/intent/previous/postgres.service'

import { replacePreviousChangeFieldValues } from './change.service'

import type {
  ChangePrimaryKey,
  FullChange,
  ChangePreviousFieldValue,
  Change
} from '../../schemas/change.schema'
import type {
  Query,
  QueryColumn,
  QueryExecutionResponse
} from '../../schemas/query-execution.schema'
import type { ConnectionSelectWithEncryption } from '../../types/kysely/connection/connection.type'
import type { SortDB } from '../../types/kysely.type'
import type { Transaction } from 'kysely'

/**
 * Builds the previous values for a change and attempts to insert into a database.
 */
export const storePreviousChanges = async ({
  trx,
  changes
}: {
  trx: Transaction<SortDB>
  changes: FullChange[]
}) => {
  const groups = changes.reduce(
    (acc, change) => {
      const key = `${change.metadata_schema_name}.${change.metadata_table_name}`
      if (!acc[key]) {
        acc[key] = [change]
      } else {
        acc[key].push(change)
      }
      return acc
    },
    {} as Record<string, FullChange[]>
  )

  for (const tableGroup of Object.values(groups)) {
    const result = await getCurrentData(tableGroup)
    await replacePreviousData(trx, tableGroup, result)
  }
}

export const isEqual = (
  primaryKey: ChangePrimaryKey,
  col: QueryColumn,
  value: unknown
) => {
  if (primaryKey.column_name !== col.name) {
    throw new NotFoundError('column', {
      missingColumnName: primaryKey.column_name
    })
  }

  // FIXME col.type === binary (isEqual should also support binary columns)

  switch (col.type) {
    case 'string':
      if (typeof value !== 'string' && value !== null) {
        throw new TypeColumnMismatchError(primaryKey, value, col)
      }
      return primaryKey.string_value === String(value)
    case 'numeric':
      if (value !== null && !/number|string/.test(typeof value)) {
        throw new TypeColumnMismatchError(primaryKey, value, col)
      }
      return String(primaryKey.numeric_value) === String(value)
    case 'date':
      if (!(value instanceof Date) && value !== null) {
        throw new TypeColumnMismatchError(primaryKey, value, col)
      }
      return primaryKey.date_value?.getTime() === value?.getTime()
    case 'boolean':
      if (
        !(String(value) === 'true' || String(value) === 'false') &&
        value !== null
      ) {
        throw new TypeColumnMismatchError(primaryKey, value, col)
      }
      return primaryKey.boolean_value === (String(value) === 'true')
    case 'json':
      return primaryKey.json_value === value
    case 'uuid':
      if (!uuidFormat.test(String(value)) && value !== null) {
        throw new TypeColumnMismatchError(primaryKey, value, col)
      }
      return primaryKey.uuid_value === String(value)
    case 'unknown':
      throw new UnknownColumnTypeError({ columnName: col.name, type: col.type })
  }
}

export const identifyRowByPrimaryKeys = (
  primaryKeys: ChangePrimaryKey[],
  row: unknown[],
  columns: QueryColumn[]
) => {
  for (let i = 0; i < primaryKeys.length; i++) {
    const pk = primaryKeys[i]
    const idx = columns.findIndex(c => c.name === pk.column_name)
    const col = columns[idx]
    if (!col) {
      throw new NotFoundError('column', { missingColumnName: pk.column_name })
    }
    const value = row[idx]
    if (!isEqual(pk, col, value)) {
      return false
    }
  }
  return true
}

export const getFieldValue = (
  changeId: string,
  col: QueryColumn,
  value: unknown
) => {
  return {
    id: randomUUID(),
    change_id: changeId,
    column_name: col.name,
    is_value_null: value === null,
    string_value:
      col.type === 'string'
        ? value === null
          ? null
          : String(value)
        : undefined,
    numeric_value:
      col.type === 'numeric'
        ? value === null
          ? null
          : // this could be money, so trim any preceding $
            String(value).replace('$', '')
        : undefined,
    date_value:
      col.type === 'date'
        ? value === null
          ? null
          : value instanceof Date
            ? value
            : new Date(String(value))
        : undefined,
    boolean_value:
      col.type === 'boolean'
        ? value === null
          ? null
          : String(value).toLowerCase() === 'true'
        : undefined,
    json_value: col.type === 'json' ? value : undefined,
    binary_value:
      col.type === 'binary' ? (value === null ? null : value) : undefined,
    uuid_value:
      col.type === 'uuid' ? (value === null ? null : String(value)) : undefined
  } as ChangePreviousFieldValue
}

export const getFieldValues = (
  change: Pick<FullChange, 'id'>,
  row: unknown[],
  columns: QueryColumn[]
) => {
  const fieldValues: ChangePreviousFieldValue[] = []
  for (let idx = 0; idx < columns.length; idx++) {
    const col = columns[idx]
    const value = row[idx]
    fieldValues.push(getFieldValue(change.id, col, value))
  }
  return fieldValues
}

export const getFieldValuesFromRecord = (
  change: Pick<FullChange, 'id'>,
  values: Record<string, unknown>,
  columns: QueryColumn[]
) => {
  const fieldValues: ChangePreviousFieldValue[] = []
  if (columns.length !== Object.keys(values).length) {
    throw new Error('Columns and values must have the same length')
  }
  for (const col of columns) {
    const value = values[col.name]
    fieldValues.push(getFieldValue(change.id, col, value))
  }
  return fieldValues
}

export const replacePreviousData = async (
  trx: Transaction<SortDB>,
  changes: FullChange[],
  result: QueryExecutionResponse
) => {
  const rows = []

  for (const change of changes) {
    const record = result.records.find(r =>
      identifyRowByPrimaryKeys(change.primary_keys, r, result.columns)
    )
    if (!record) {
      throw new RowMissingError({ change })
    }

    const fieldValues = getFieldValues(change, record, result.columns)
    rows.push(...fieldValues)
  }

  await replacePreviousChangeFieldValues(trx, rows)
}

/**
 * Takes a snapshot of the current set of changes against the customer/remote database.
 * @param schemaTableChanges
 * @returns
 */
export const getCurrentData = async (schemaTableChanges: FullChange[]) => {
  if (schemaTableChanges.length === 0) {
    throw new Error('schemaTableChanges must have at least one change')
  }

  const firstChange = schemaTableChanges[0]

  const table = await getTableFromCurrentSnapshot(
    firstChange.connection_id,
    firstChange.metadata_database_name,
    firstChange.metadata_schema_name,
    firstChange.metadata_table_name
  )

  if (!table) {
    throw new NotFoundError('table', {
      missingTableName: firstChange.metadata_table_name,
      missingTableSchemaName: firstChange.metadata_schema_name,
      missingTableDatabaseName: firstChange.metadata_database_name
    })
  }

  const columns = await getColumnsByTableId(table.id)
  if (!columns) {
    throw new NotFoundError('columns', {
      missingTableName: firstChange.metadata_table_name,
      missingTableSchemaName: firstChange.metadata_schema_name,
      missingTableDatabaseName: firstChange.metadata_database_name
    })
  }

  const query = {
    type: 'intent',
    intent: {
      dml: 'SELECT',
      schema: firstChange.metadata_schema_name,
      table: firstChange.metadata_table_name,
      columns: columns.map(col => col.name),
      combinator: 'AND',
      filters: [],
      orders: [],
      limit: schemaTableChanges.length
    }
  } satisfies Query

  const conn = await getById(firstChange.connection_id)
  if (!conn) {
    throw new NotFoundError('connection', {
      missingConnectionId: firstChange.connection_id
    })
  }

  const querySvc = new PostgresPreviousQueryService(conn, schemaTableChanges)
  const result = await querySvc.execute(
    firstChange.metadata_database_name,
    query
  )
  return result
}

export const addPrimaryKeys = async (
  trx: Transaction<SortDB>,
  connection: Pick<ConnectionSelectWithEncryption, 'id' | 'data_provider'>,
  change: Change,
  primaryKeysNames: string[],
  primaryKeysValues: Record<string, unknown>
) => {
  if (change.action !== 'ADD') {
    throw new Error('change must be ADD')
  }

  const table = await getTableFromCurrentSnapshot(
    change.connection_id,
    change.metadata_database_name,
    change.metadata_schema_name,
    change.metadata_table_name
  )

  if (!table) {
    throw new NotFoundError('table', {
      missingTableName: change.metadata_table_name,
      missingTableSchemaName: change.metadata_schema_name,
      missingTableDatabaseName: change.metadata_database_name
    })
  }

  const columns = await getColumnsByTableId(table.id)
  if (!columns) {
    throw new NotFoundError('columns', {
      missingTableName: change.metadata_table_name,
      missingTableSchemaName: change.metadata_schema_name,
      missingTableDatabaseName: change.metadata_database_name
    })
  }

  const primaryKeyColumns = columns
    .filter(c => primaryKeysNames.includes(c.name))
    .map(c => getColumn(connection, c.name, c.type))

  const primaryKeys = getFieldValuesFromRecord(
    change,
    primaryKeysValues,
    primaryKeyColumns
  )

  const rows = primaryKeys.map(pk => ({
    id: randomUUID(),
    change_id: change.id,
    column_name: pk.column_name,
    string_value: pk.string_value,
    numeric_value: pk.numeric_value,
    date_value: pk.date_value,
    boolean_value: pk.boolean_value,
    json_value: toJSONB(pk.json_value),
    binary_value: pk.binary_value
      ? Buffer.from(pk.binary_value, 'base64')
      : null,
    uuid_value: pk.uuid_value
  }))

  return await trx
    .insertInto('change_previous_primary_key')
    .values(rows)
    .execute()
}
