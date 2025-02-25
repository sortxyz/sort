import { Pg7DatabaseError, SnowflakeDatabaseError } from '../errors'

import type { BaseCapturableDatabaseError } from '../errors'
import type { ConnectionDataProvider } from '../schemas/data-provider.schema'

export const isCapturableDatabaseError = (
  error: unknown,
  dbType: ConnectionDataProvider
): error is Error => {
  switch (dbType) {
    case 'postgres':
      return Pg7DatabaseError.isCapturableError(error)
    case 'snowflake':
      return SnowflakeDatabaseError.isCapturableError(error)
    default:
      return false
  }
}

export const getCapturableDatabaseError = (
  error: unknown,
  dbType: ConnectionDataProvider
): BaseCapturableDatabaseError => {
  switch (dbType) {
    case 'postgres':
      return new Pg7DatabaseError(error)
    case 'snowflake':
      return new SnowflakeDatabaseError(error)
    default:
      throw new Error('Not a capturable database error.')
  }
}
