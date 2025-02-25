import assert from 'node:assert'

import { Type } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'

import { pg7ErrorConditionCodes } from '../../constants/database.constant'
import { objectKeysWithType } from '../../utils/object.util'

import { BaseCapturableDatabaseError } from './base-capturable-database.error'

import type { Static } from '@sinclair/typebox'

// ref: https://github.com/brianc/node-postgres/blob/522e2dcb76f92d0096177b10204bdc385375020d/packages/pg-protocol/src/messages.ts#L97
// this differs from the exact shape because the compiled d.ts is different than the class here
// recommend compiling the node-postgres lib if this causes future issues
const Pg7ErrorSchema = Type.Object({
  name: Type.Optional(Type.String()),
  severity: Type.Optional(Type.String()),
  code: Type.Optional(Type.String()),
  length: Type.Optional(Type.Number()),
  detail: Type.Optional(Type.String()),
  hint: Type.Optional(Type.String()),
  position: Type.Optional(Type.String()),
  internalPosition: Type.Optional(Type.String()),
  internalQuery: Type.Optional(Type.String()),
  where: Type.Optional(Type.String()),
  schema: Type.Optional(Type.String()),
  table: Type.Optional(Type.String()),
  column: Type.Optional(Type.String()),
  dataType: Type.Optional(Type.String()),
  constraint: Type.Optional(Type.String()),
  file: Type.Optional(Type.String()),
  line: Type.Optional(Type.String()),
  routine: Type.Optional(Type.String())
})

const Pg7ErrorTypeCheck = TypeCompiler.Compile(Pg7ErrorSchema)

type Pg7ErrorType = Static<typeof Pg7ErrorSchema>

export class Pg7DatabaseError extends BaseCapturableDatabaseError {
  static isPg7Error(error: unknown): error is Pg7ErrorType {
    return error instanceof Error && Pg7ErrorTypeCheck.Check(error)
  }

  static isCapturableError(error: unknown): boolean {
    if (!Pg7DatabaseError.isPg7Error(error)) {
      return false
    }

    return Object.values(pg7ErrorConditionCodes).some(n => n === error?.code)
  }

  constructor(message: unknown, options?: ErrorOptions) {
    super(message, options)

    const cause = options?.cause ?? message

    assert.ok(Pg7DatabaseError.isPg7Error(cause), 'Not a PG7 database error.')

    // we try the provider's hint -> then kysely sourced message -> then lookup the code name
    this.helpfulProviderMessage = String(
      cause.hint ??
        message ??
        (Object.values(pg7ErrorConditionCodes).includes(cause?.code ?? '')
          ? objectKeysWithType(pg7ErrorConditionCodes).find(
              n => pg7ErrorConditionCodes[n] === cause?.code
            )
          : '')
    )
  }
}
