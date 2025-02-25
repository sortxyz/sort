import { PublicFacingError } from '../../errors/public-facing.error'

import { PostgresService } from './postgres.service'
import { SnowflakeService } from './snowflake.service'

import type { ConnectionServiceBase } from './base.service'
import type { ConnectionDataProvider } from '../../schemas/data-provider.schema'
import type { ConnectionInsert } from '../../types/kysely/connection/connection.type'

export const createConnectionService = (
  connection: ConnectionInsert
): ConnectionServiceBase<ConnectionDataProvider> => {
  switch (connection.data_provider) {
    case 'postgres':
      return new PostgresService(connection)
    case 'snowflake':
      return new SnowflakeService(connection)
    default:
      throw new Error('Invalid data provider')
  }
}

/**
 * Retrieves a working connection or throws if unsuccessful.
 */
export const retrieveWorkingConnection = async (
  connection: ConnectionInsert
): Promise<ConnectionInsert> => {
  const connectionService = createConnectionService(connection)
  const testResult = await connectionService.tryCreateConnection()

  if (!testResult) {
    throw new PublicFacingError(
      `Connection "${connection.name}" failed to connect.`
    )
  }

  if (
    testResult.with_ssl !== connection.with_ssl ||
    testResult.connection_string !== connection.connection_string ||
    testResult.warehouse !== connection.warehouse
  ) {
    return {
      ...connection,
      with_ssl: testResult.with_ssl,
      connection_string: testResult.connection_string,
      visibility: testResult.visibility,
      warehouse: testResult.warehouse
    } satisfies ConnectionInsert
  }

  return connection
}
