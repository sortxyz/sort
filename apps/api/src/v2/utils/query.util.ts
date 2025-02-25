import { PostgresIntentQueryService } from '@sort/shared/services/query/execution/intent/postgres.service'
import { SnowflakeIntentQueryService } from '@sort/shared/services/query/execution/intent/snowflake.service'
import { PostgresSqlQueryService } from '@sort/shared/services/query/execution/sql/postgres.service'
import { SnowflakeSqlQueryService } from '@sort/shared/services/query/execution/sql/snowflake.service'

import type { BaseQueryService } from '@sort/shared/services/query/execution/base'
import type * as ConnectionType from '@sort/shared/types/kysely/connection/connection.type'

export const createQueryExecutionService = async (
  connection: ConnectionType.ConnectionSelectWithEncryption,
  queryType: 'sql' | 'intent'
): Promise<BaseQueryService> => {
  switch (queryType) {
    case 'intent':
      switch (connection.data_provider) {
        case 'postgres':
          return new PostgresIntentQueryService(connection)
        case 'snowflake':
          return new SnowflakeIntentQueryService(connection)
        default:
          throw new Error('Invalid data provider')
      }
    case 'sql':
      switch (connection.data_provider) {
        case 'postgres':
          return new PostgresSqlQueryService(connection)
        case 'snowflake':
          return new SnowflakeSqlQueryService(connection)
        default:
          throw new Error('Invalid data provider')
      }
    default:
      throw new Error('Invalid query type')
  }
}
