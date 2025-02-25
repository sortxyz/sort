import { randomUUID } from 'crypto'

import { NonNullableColumnError } from '../../errors/change-requests/non-nullable.error'
import {
  InvalidValueError,
  UnknownColumnTypeError
} from '../../errors/change-requests/unknown.error'
import { NotFoundError } from '../../errors/not-found.error'
import { uuidRegExp } from '../../utils'
import { getReverseProviderColumnMappings } from '../../utils/column-mapping.util'
import * as ConnectionService from '../connection.service'
import { getColumnsByTableId } from '../kysely/snapshot/column.service'
import { getTableFromCurrentSnapshot } from '../kysely/snapshot/table.service'

import {
  dbMapper,
  dbFieldToResponseField,
  insertChangeWithValues,
  getPreviousFieldValuesForChange
} from './change.service'
import { storePreviousChanges } from './previous-change.service'
import {
  validateNoDuplicates,
  validateNonNullFieldsForInsert,
  validatePrimaryKeys
} from './validation.service'

import type { DataProviderReverseColumnMapping } from '../../constants/database.constant'
import type {
  ChangeFieldValue,
  ChangePrimaryKey,
  ChangeResponse,
  RequestChange,
  RequestChangeFieldValue
} from '../../schemas/change.schema'
import type { ConnectionDataProvider } from '../../schemas/data-provider.schema'
import type { ConnectionSelectWithEncryption } from '../../types/kysely/connection/connection.type'
import type { ColumnSelect } from '../../types/kysely/snapshot/column.type'
import type { SortDB } from '../../types/kysely.type'
import type { Transaction } from 'kysely'

export const checkFieldValue = ({
  column,
  field,
  columnMappings,
  change
}: {
  column: ColumnSelect
  field: RequestChangeFieldValue
  columnMappings: DataProviderReverseColumnMapping
  change: RequestChange
}) => {
  let valueFieldName = ''
  let valueField: string | number | boolean | Date | null = null

  if (field.value === null && column.nullable === false) {
    throw new NonNullableColumnError(column.name, {
      cause: {
        change,
        field
      }
    })
  }

  const columnType = columnMappings[column.type]
  if (!columnType) {
    throw new UnknownColumnTypeError({
      columnName: field.column_name,
      type: column.type
    })
  }

  switch (columnType) {
    case 'uuid': {
      valueFieldName = 'uuid_value'

      if (field.value === null) {
        valueField = null
      } else if (
        typeof field.value === 'string' &&
        uuidRegExp.test(field.value)
      ) {
        valueField = field.value
      } else {
        throw new InvalidValueError(field, column.type, change)
      }
      break
    }
    case 'string': {
      valueFieldName = 'string_value'

      if (field.value === null) {
        valueField = null
      } else if (typeof field.value === 'string') {
        valueField = field.value
      } else {
        throw new InvalidValueError(field, column.type, change)
      }
      break
    }
    case 'numeric': {
      valueFieldName = 'numeric_value'

      if (field.value === null) {
        valueField = null
      } else if (
        typeof field.value === 'number' &&
        Number.isFinite(field.value)
      ) {
        valueField = field.value
      } else if (typeof field.value === 'string') {
        // let the change applier catch invalid strings for now
        valueField = field.value
      } else {
        throw new InvalidValueError(field, column.type, change)
      }
      break
    }
    case 'date': {
      valueFieldName = 'date_value'

      if (field.value === null) {
        valueField = null
      } else if (field.value instanceof Date) {
        if (String(field.value) === 'Invalid Date') {
          throw new InvalidValueError(field, column.type, change)
        }
        valueField = field.value
      } else if (typeof field.value !== 'string') {
        throw new InvalidValueError(field, column.type, change)
      } else {
        const date = new Date(field.value)
        if (String(date) === 'Invalid Date') {
          throw new InvalidValueError(field, column.type, change)
        }
        valueField = date
      }
      break
    }
    case 'boolean': {
      valueFieldName = 'boolean_value'

      if (field.value === null) {
        valueField = null
      } else if (typeof field.value !== 'boolean') {
        throw new InvalidValueError(field, column.type, change)
      } else {
        valueField = field.value
      }
      break
    }
    case 'json': {
      valueFieldName = 'json_value'

      if (field.value === null) {
        valueField = null
      } else if (typeof field.value === 'string') {
        try {
          // try to find any errors in parsing
          JSON.parse(field.value)
          valueField = field.value
        } catch (err) {
          throw new InvalidValueError(field, column.type, change)
        }
      } else {
        throw new InvalidValueError(field, column.type, change)
      }
      break
    }
    case 'binary':
      valueFieldName = 'binary_value'

      if (field.value === null) {
        valueField = null
      } else if (typeof field.value === 'string') {
        try {
          valueField = Buffer.from(field.value, 'base64').toString('base64')
        } catch (err) {
          throw new InvalidValueError(field, column.type, change)
        }
      } else {
        throw new InvalidValueError(field, column.type, change)
      }
      break
    default:
      throw new UnknownColumnTypeError({
        columnName: field.column_name,
        type: column.type
      })
  }

  return { valueFieldName, valueField }
}

export const makeBaseRow = ({
  field,
  change,
  columns,
  dataProvider
}: {
  field: RequestChangeFieldValue
  change: RequestChange
  columns: ColumnSelect[]
  dataProvider: ConnectionDataProvider
}) => {
  const column = columns.find(c => c.name === field.column_name)
  if (!column) {
    throw new NotFoundError('column', { missingColumnName: field.column_name })
  }

  const columnMappings = getReverseProviderColumnMappings(dataProvider)
  return checkFieldValue({
    column,
    field,
    columnMappings,
    change
  })
}

export const fieldToRow = ({
  changeId,
  dataProvider,
  field,
  change,
  columns
}: {
  changeId: string
  dataProvider: ConnectionDataProvider
  field: RequestChangeFieldValue
  change: RequestChange
  columns: ColumnSelect[]
}) => {
  const { valueFieldName, valueField } = makeBaseRow({
    field,
    change,
    columns,
    dataProvider
  })

  const row = {
    id: randomUUID(),
    change_id: changeId,
    column_name: field.column_name,
    [valueFieldName]: valueField,
    is_value_null: valueField === null
  }

  return row
}

export const pkeyToRow = ({
  changeId,
  dataProvider,
  field,
  columns,
  change
}: {
  changeId: string
  dataProvider: ConnectionDataProvider
  field: RequestChangeFieldValue
  columns: ColumnSelect[]
  change: RequestChange
}) => {
  const { valueFieldName, valueField } = makeBaseRow({
    field,
    change,
    columns,
    dataProvider
  })

  const row = {
    id: randomUUID(),
    change_id: changeId,
    column_name: field.column_name,
    [valueFieldName]: valueField
  }

  return row
}

export const getColumnsFromChangeRows = async (
  rows: { schema_name: string; table_name: string }[],
  connectionId: string,
  database_name: string
) => {
  const connection = await ConnectionService.getById(connectionId)
  if (!connection) {
    throw new NotFoundError('connection')
  }

  // the key here is the form of `${schema_name}.${table_name}`
  const schemaTableColumnsMap = new Map<string, ColumnSelect[]>()
  const uniqueSchemaTables = new Set<string>(
    rows.map(row => `${row.schema_name}.${row.table_name}`)
  )

  for (const schemaTable of uniqueSchemaTables.values()) {
    const [schemaName, tableName] = schemaTable.split('.')
    if (!schemaTableColumnsMap.has(schemaTable)) {
      const table = await getTableFromCurrentSnapshot(
        connection.id,
        database_name,
        schemaName,
        tableName
      )

      if (!table) {
        throw new NotFoundError('table', {
          missingTableSchemaName: schemaName,
          missingTableDatabaseName: database_name,
          missingTableName: tableName
        })
      }

      const columns = await getColumnsByTableId(table.id)
      if (!columns) {
        throw new NotFoundError('column')
      }

      schemaTableColumnsMap.set(schemaTable, columns)
    }
  }

  return schemaTableColumnsMap
}

export const buildRowFromChange = ({
  changeRequestId,
  change,
  connection,
  columns,
  databaseName,
  index
}: {
  changeRequestId: string
  change: RequestChange
  connection: ConnectionSelectWithEncryption
  columns: ColumnSelect[]
  databaseName: string
  index: number
}) => {
  let fields: ChangeFieldValue[] = []
  let keys: ChangePrimaryKey[] = []

  const changeId = randomUUID()

  if (change.action === 'ADD' || change.action === 'MODIFY') {
    fields = change.fields.map(field => {
      return fieldToRow({
        changeId,
        dataProvider: connection.data_provider,
        field,
        change,
        columns
      })
    })
  }

  if (change.action === 'DELETE' || change.action === 'MODIFY') {
    keys = change.primary_keys.map(pkey => {
      return pkeyToRow({
        changeId,
        dataProvider: connection.data_provider,
        field: pkey,
        change,
        columns
      })
    })
  }

  return {
    original: change,
    change: {
      id: changeId,
      change_request_id: changeRequestId,
      index,
      action: change.action,
      connection_id: connection.id,
      metadata_database_name: databaseName,
      metadata_table_name: change.table_name,
      metadata_schema_name: change.schema_name
    },
    fields,
    keys
  }
}

/**
 * Constructs changes from input rows via a request. Validates against our imported schemas and types/shapes enforcement.
 */
export const buildRowsFromChanges = async (
  changeRequestId: string,
  changes: RequestChange[],
  connectionId: string,
  databaseName: string
) => {
  const rows: ReturnType<typeof buildRowFromChange>[] = []

  if (!changes) {
    return rows
  }

  const connection = await ConnectionService.getById(connectionId)
  if (!connection) {
    throw new NotFoundError('connection')
  }

  const schemaTableColumnsMap = await getColumnsFromChangeRows(
    changes,
    connectionId,
    databaseName
  )

  for (let index = 0; index < changes.length; index++) {
    const change = changes[index]
    const columns =
      schemaTableColumnsMap.get(`${change.schema_name}.${change.table_name}`) ??
      []

    rows.push(
      buildRowFromChange({
        changeRequestId,
        change,
        connection,
        columns,
        databaseName,
        index
      })
    )
  }

  return rows
}

/**
 * Creates changes in the database for an existing change request.
 */
export const createChanges = async (
  trx: Transaction<SortDB>,
  changeRequestId: string,
  connectionId: string,
  databaseName: string,
  changes: RequestChange[]
) => {
  const processedChanges = await buildRowsFromChanges(
    changeRequestId,
    changes,
    connectionId,
    databaseName
  )
  for (const processedChange of processedChanges) {
    const { change, fields, keys, original } = processedChange

    if (original.action === 'ADD') {
      await validateNonNullFieldsForInsert({
        change,
        connectionId,
        databaseName,
        fields: original.fields
      })
    }

    if (change.action === 'ADD' || change.action === 'MODIFY') {
      if (fields.length) validateNoDuplicates(fields)
    }

    if (keys.length) {
      validateNoDuplicates(keys)
      await validatePrimaryKeys({
        change,
        connectionId,
        databaseName,
        keys
      })
    }

    await insertChangeWithValues({
      trx,
      change,
      fieldValues: fields,
      primaryKeys: keys
    })
  }

  // store previous customer data related to changes we just created
  const updateOrDeleteChanges = processedChanges.filter(
    c => c.change.action === 'MODIFY' || c.change.action === 'DELETE'
  )
  if (updateOrDeleteChanges.length) {
    await storePreviousChanges({
      trx,
      changes: updateOrDeleteChanges.map(c => ({
        ...c.change,
        fields: c.fields,
        primary_keys: c.keys,
        previous_fields: []
      }))
    })
  }

  const createdChanges = await Promise.all(
    processedChanges.map(async processedChange => {
      if (processedChange.change.action === 'ADD') {
        return {
          id: processedChange.change.id,
          change_request_id: processedChange.change.change_request_id,
          database_name: processedChange.change.metadata_database_name,
          schema_name: processedChange.original.schema_name,
          table_name: processedChange.original.table_name,
          action: processedChange.change.action,
          index: processedChange.change.index,
          fields: processedChange.fields.map(field =>
            dbFieldToResponseField(dbMapper(field))
          )
        }
      } else if (processedChange.change.action === 'DELETE') {
        const previous = await getPreviousFieldValuesForChange(
          trx,
          processedChange.change.id
        )
        return {
          id: processedChange.change.id,
          change_request_id: processedChange.change.change_request_id,
          database_name: processedChange.change.metadata_database_name,
          schema_name: processedChange.original.schema_name,
          table_name: processedChange.original.table_name,
          action: processedChange.change.action,
          index: processedChange.change.index,
          primary_keys: processedChange.keys.map(pk =>
            dbFieldToResponseField(dbMapper(pk))
          ),
          previous_fields: previous.map(field => dbFieldToResponseField(field))
        }
      } else if (processedChange.change.action === 'MODIFY') {
        const previous = await getPreviousFieldValuesForChange(
          trx,
          processedChange.change.id
        )
        return {
          id: processedChange.change.id,
          change_request_id: processedChange.change.change_request_id,
          database_name: processedChange.change.metadata_database_name,
          schema_name: processedChange.original.schema_name,
          table_name: processedChange.original.table_name,
          action: processedChange.change.action,
          index: processedChange.change.index,
          fields: processedChange.fields.map(field =>
            dbFieldToResponseField(dbMapper(field))
          ),
          primary_keys: processedChange.keys.map(pk =>
            dbFieldToResponseField(dbMapper(pk))
          ),
          previous_fields: previous.map(field => dbFieldToResponseField(field))
        }
      } else {
        throw new Error(
          'Unknown change action. Must be ADD, DELETE, or MODIFY.'
        )
      }
    })
  )

  return createdChanges satisfies ChangeResponse[]
}
