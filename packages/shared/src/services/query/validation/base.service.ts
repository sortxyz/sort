import type { ConnectionDataProvider } from '../../../schemas/data-provider.schema'
import type { QueryValidation } from '../../../schemas/query-validation.schema'

export abstract class BaseValidationQueryService {
  constructor(
    protected connectionId: string,
    protected dataProvider: ConnectionDataProvider,
    protected sql: string
  ) {
    if (!connectionId || connectionId.trim() === '') {
      throw new Error('Connection ID is required')
    }

    if (!sql || sql.trim() === '') {
      throw new Error('SQL is required')
    }
  }

  abstract validate(database: string, sql: string): QueryValidation
}
