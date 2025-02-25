import {
  PostgresReverseColumnMappings,
  SnowflakeReverseColumnMappings
} from '../constants/database.constant'

import type { ConnectionDataProvider } from '../schemas/data-provider.schema'

export const getReverseProviderColumnMappings = (
  dataProvider: ConnectionDataProvider
) => {
  switch (dataProvider) {
    case 'postgres':
      return PostgresReverseColumnMappings
    case 'snowflake':
      return SnowflakeReverseColumnMappings
    default:
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      throw new Error(`Unknown data provider: ${dataProvider}`)
  }
}
