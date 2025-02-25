import {
  postgresColumnTypeMapper,
  snowflakeColumnTypeMapper
} from '../../utils/col-mapper.util'

import type { QueryColumn } from '../../schemas/query-execution.schema'
import type { ResponseColumnTypes } from '../../schemas/response-column.schema'
import type { ConnectionSelectWithEncryption } from '../../types/kysely/connection/connection.type'

export type ColumnTypeMapper = (
  connection: Pick<ConnectionSelectWithEncryption, 'id'>,
  columnType: string | undefined
) => ResponseColumnTypes | 'unknown'

export const getColumnTypeMapper = (
  connection: Pick<ConnectionSelectWithEncryption, 'id' | 'data_provider'>
): ColumnTypeMapper => {
  switch (connection.data_provider) {
    case 'postgres':
      return postgresColumnTypeMapper
    case 'snowflake':
      return snowflakeColumnTypeMapper
    default:
      throw new Error('Invalid data provider')
  }
}

export const getColumn = (
  connection: Pick<ConnectionSelectWithEncryption, 'id' | 'data_provider'>,
  name: string,
  type: string | undefined
) => {
  const mapper = getColumnTypeMapper(connection)
  return {
    name,
    type: mapper(connection, type)
  } satisfies QueryColumn
}
