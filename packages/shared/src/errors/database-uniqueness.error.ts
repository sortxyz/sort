import * as assert from 'node:assert'

import { pg7ErrorConditionCodes } from '../constants/database.constant'

/**
 * Represents a database unique constraint violation error.
 */
export class DatabaseUniquenessError extends Error {
  /** The table in which the unique constraint was violated. */
  table: string

  /** The column violating the unique constraint. */
  column: string

  /** The value violating the unique constraint. */
  value: string

  /** The name of the violated constraint. */
  constraint: string

  static isViolationError(error: unknown) {
    const err = error as Error & { code: string }
    return err?.code === pg7ErrorConditionCodes.UNIQUE_VIOLATION
  }

  constructor(message: unknown, options?: ErrorOptions) {
    const msg =
      typeof message === 'string'
        ? message
        : message instanceof Error
          ? message.message
          : ((options?.cause as Error)?.message ?? 'Unknown error.')

    const cause = (options?.cause ?? message) as Error & {
      detail: string
      code: string
      table: string
      constraint: string
    }

    assert.ok(
      DatabaseUniquenessError.isViolationError(cause),
      'Not a unique constraint violation.'
    )

    super(msg, options)

    this.table = cause.table ?? ''
    this.constraint = cause.constraint ?? ''

    if (/^Key \(.*\)=\(.*\)/i.test(cause.detail)) {
      const split = cause.detail?.split('=')

      const colMatch = split[0].match(/\((.*)\)/)
      const column = colMatch ? colMatch[1] : ''
      this.column = column

      const valMatch = split[1].match(/\((.*)\)/)
      const value = valMatch ? valMatch[1] : ''
      this.value = value
    } else {
      this.column = ''
      this.value = ''
    }
  }
}
