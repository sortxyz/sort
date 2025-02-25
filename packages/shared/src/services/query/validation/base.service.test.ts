import { BaseValidationQueryService } from './base.service'

import type { ConnectionDataProvider } from '../../../schemas/data-provider.schema'
import type { QueryValidation } from '../../../schemas/query-validation.schema'

class ValidationQueryService extends BaseValidationQueryService {
  constructor(
    connectionId: string,
    database: ConnectionDataProvider,
    sql: string
  ) {
    super(connectionId, database, sql)
  }

  validate(): QueryValidation {
    return { database: '', query: '', is_sort_queryable: true }
  }
}

describe('BaseService', () => {
  it('should require a connection ID', async () => {
    expect(() => new ValidationQueryService('', 'snowflake', 'sfsdf')).toThrow(
      'Connection ID is required'
    )
  })

  it('should require SQL', async () => {
    expect(
      () => new ValidationQueryService('conn-id', 'snowflake', '')
    ).toThrow('SQL is required')
  })
})
