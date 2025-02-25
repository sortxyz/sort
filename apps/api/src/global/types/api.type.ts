import { Type } from '@sinclair/typebox'

import type { TSchema } from '@sinclair/typebox'

// eslint-disable-next-line
export const GeneralError = Type.Object({
  code: Type.Number(),
  message: Type.String()
})

// eslint-disable-next-line
export const SchemaValidationError = Type.Object({
  error: Type.String(),
  message: Type.String(),
  statusCode: Type.Number()
})

// eslint-disable-next-line
export const GeneralSuccess = <T extends TSchema>(t: T) =>
  Type.Object({
    code: Type.Number(),
    data: t
  })
