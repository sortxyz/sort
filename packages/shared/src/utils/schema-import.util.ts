import { PostgresSchemaImportService } from '../services/schema-import/pg/schema-import.service'
import { SnowflakeSchemaImportService } from '../services/schema-import/snowflake/schema-import.service'

import type { ConnectionDataProvider } from '../schemas/data-provider.schema'
import type { BaseSchemaImportService } from '../services/schema-import/schema-import.base.service'
import type * as ConnectionType from '../types/kysely/connection/connection.type'

export const createSchemaImporter = (
  connection: ConnectionType.ConnectionSelectWithEncryption
): BaseSchemaImportService<ConnectionDataProvider> => {
  switch (connection.data_provider) {
    case 'postgres':
      return new PostgresSchemaImportService(connection)
    case 'snowflake':
      return new SnowflakeSchemaImportService(connection)
    default:
      throw new Error('Invalid data provider')
  }
}
