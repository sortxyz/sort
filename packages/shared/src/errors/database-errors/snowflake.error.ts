import assert from 'node:assert'

import { Type } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'

import { snowflakeErrorConditionCodes } from '../../constants/database.constant'
import { objectKeysWithType } from '../../utils/object.util'

import { BaseCapturableDatabaseError } from './base-capturable-database.error'

import type { Static } from '@sinclair/typebox'

const SnowflakeErrorSchema = Type.Object({
  code: Type.String(),
  sqlState: Type.String(),
  cause: Type.Optional(Type.String()),
  data: Type.Object({
    internalError: Type.Optional(Type.Boolean()),
    errorCode: Type.String(),
    age: Type.Number(),
    sqlState: Type.String(),
    queryId: Type.Union([Type.String(), Type.Null()])
  })
})

const SnowflakeErrorTypeCheck = TypeCompiler.Compile(SnowflakeErrorSchema)

type SnowflakeErrorType = Static<typeof SnowflakeErrorSchema>

export class SnowflakeDatabaseError extends BaseCapturableDatabaseError {
  static isSnowflakeError(error: unknown): error is SnowflakeErrorType {
    return error instanceof Error && SnowflakeErrorTypeCheck.Check(error)
  }

  static isCapturableError(error: unknown): boolean {
    if (!SnowflakeDatabaseError.isSnowflakeError(error)) {
      return false
    }

    return Object.values(snowflakeErrorConditionCodes).some(
      n => n === error.code
    )
  }

  constructor(message: unknown, options?: ErrorOptions) {
    super(message, options)

    const cause = options?.cause ?? message

    assert.ok(
      SnowflakeDatabaseError.isSnowflakeError(cause),
      'Not a Snowflake database error.'
    )

    // we try the provider's cause -> then kysely sourced message -> then lookup the code name
    this.helpfulProviderMessage = String(
      cause.cause ??
        message ??
        (Object.values(snowflakeErrorConditionCodes).includes(cause?.code ?? '')
          ? objectKeysWithType(snowflakeErrorConditionCodes).find(
              n => snowflakeErrorConditionCodes[n] === cause?.code
            )
          : '')
    )
  }
}
