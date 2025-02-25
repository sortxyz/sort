import { logger } from '../bootstrap'
import {
  PostgresColumnMappings,
  SnowflakeColumnMappings
} from '../constants/database.constant'
import { ResponseColumnTypesArray } from '../schemas/response-column.schema'

import type { ResponseColumnTypes } from '../schemas/response-column.schema'
import type { ConnectionSelectWithEncryption } from '../types/kysely/connection/connection.type'

/** Maps the `columnType` from our imported schema to a column type we support. */
export const postgresColumnTypeMapper = (
  connection: Pick<ConnectionSelectWithEncryption, 'id'>,
  columnType: string | undefined
): ResponseColumnTypes | 'unknown' => {
  if (columnType === undefined) return 'unknown'

  for (const key of ResponseColumnTypesArray) {
    if (key in PostgresColumnMappings) {
      const types = PostgresColumnMappings[key]
      if (types.includes(columnType.toLowerCase())) {
        return key
      }
    }
  }

  logger.info(`Unknown column type: ${columnType} in ${connection.id}`)

  return 'unknown'
}

/** Maps the `columnType` from our imported schema to a column type we support. */
export const snowflakeColumnTypeMapper = (
  connection: Pick<ConnectionSelectWithEncryption, 'id'>,
  columnType: string | undefined
): ResponseColumnTypes | 'unknown' => {
  if (columnType === undefined) return 'unknown'

  for (const key of ResponseColumnTypesArray) {
    if (key in SnowflakeColumnMappings) {
      const types = SnowflakeColumnMappings[key]
      if (types.includes(columnType.toLowerCase())) {
        return key
      }
    }
  }

  logger.info(`Unknown column type: ${columnType} in ${connection.id}`)

  return 'unknown'
}
