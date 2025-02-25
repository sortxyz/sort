import * as assert from 'node:assert'

import { pg7ErrorConditionCodes } from '../constants/database.constant'

/**
 * Represents a database unique constraint violation error.
 */
export class PostgresFkViolationError extends Error {
  /** The name of the violated constraint. */
  constraint: string

  /** The error detail returned by the pg driver */
  detail: string

  /** The database error code. */
  code: string

  /** A Record of additional info associated with the error */
  metadata: Record<'tableName' | 'schemaName' | 'databaseName', string>

  static isViolationError(error: unknown) {
    const err = error as Error & { code: string }
    return err?.code === pg7ErrorConditionCodes.FOREIGN_KEY_VIOLATION
  }

  constructor(
    message: unknown,
    options?: ErrorOptions & {
      tableName?: string
      schemaName?: string
      databaseName?: string
    }
  ) {
    const msg =
      typeof message === 'string'
        ? message
        : message instanceof Error
          ? message.message
          : ((options?.cause as Error)?.message ?? 'Foreign key violation.')

    const cause = (options?.cause ?? message) as Error & {
      detail: string
      code: string
      constraint: string
    }

    assert.ok(
      PostgresFkViolationError.isViolationError(cause),
      'Not a foreign key constraint violation.'
    )

    super(msg, options)

    this.code = cause.code ?? ''
    this.detail = cause.detail ?? ''
    this.constraint = cause.constraint ?? ''
    this.metadata = {
      tableName: options?.tableName ?? '',
      schemaName: options?.schemaName ?? '',
      databaseName: options?.databaseName ?? ''
    }
  }
}
