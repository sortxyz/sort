import { Type } from '@sinclair/typebox'

import { TNullable } from '../types/nullable.type'

import type { Static, TObject, TSchema, TUnion } from '@sinclair/typebox'

// these types are created based on https://ajv.js.org/guide/modifying-data.html#removing-additional-properties
// ----------------------------------------------------------------------------
// TDiscriminatedUnion
// ----------------------------------------------------------------------------
export interface TDiscriminatedUnion<T extends TSchema[] = []> extends TSchema {
  static: Static<TUnion<T>>
  oneOf: T
  discriminator: {
    propertyName: keyof T[number]
  }
  type: 'object'
}

// ----------------------------------------------------------------------------
// DiscriminatedUnion
// ----------------------------------------------------------------------------
export function DiscriminatedUnion<
  T extends TSchema[],
  TDiscriminator extends keyof Static<T[number]>
>(discriminator: TDiscriminator, schemas: [...T]): TDiscriminatedUnion<T> {
  return Type.Unsafe({
    oneOf: schemas,
    discriminator: { propertyName: discriminator, required: [discriminator] },
    type: 'object'
  }) as unknown as TDiscriminatedUnion<T>
}

export const EmailSchema = Type.String({ format: 'email' })
export const UuidSchema = Type.String({
  format: 'uuid',
  description: 'UUID v4'
})
export const DateSchema = Type.Unsafe<Date>({
  type: 'string',
  format: 'date-time'
})

const MessageSchema = Type.Object({
  message: Type.String()
})

const ValidationErrorMessageSchema = Type.Object({
  message: Type.String(),
  context: Type.String(),
  errors: Type.Object({
    query: Type.Optional(Type.Record(Type.String(), Type.String())),
    body: Type.Optional(Type.Record(Type.String(), Type.String())),
    headers: Type.Optional(Type.Record(Type.String(), Type.String())),
    params: Type.Optional(Type.Record(Type.String(), Type.String()))
  })
})

export function createMessageSchema<
  TType extends string,
  TPayload extends TObject
>(type: TType, payload: TPayload) {
  return Type.Object({
    type: Type.Literal(type),
    payload
  })
}

export const GeneralSuccessSchema = createMessageSchema(
  'success',
  Type.Object({
    success: MessageSchema
  })
)

export const GeneralErrorSchema = createMessageSchema(
  'error',
  Type.Object({
    error: MessageSchema
  })
)

export type GeneralError = Static<typeof GeneralErrorSchema>

export const GeneralWarningSchema = createMessageSchema(
  'warning',
  Type.Object({
    warning: MessageSchema
  })
)

export const ValidationErrorSchema = createMessageSchema(
  'validation_error',
  Type.Object({
    validation_error: ValidationErrorMessageSchema
  })
)

const ApiKeySchema = Type.Object({
  'x-api-key': Type.Optional(Type.String({ maxLength: 128 }))
})
export const AuthHeadersSchema = Type.Union([ApiKeySchema])

export const MarkdownColumnSchema = TNullable(
  Type.String({ maxLength: 150000 })
)
export type MarkdownColumn = Static<typeof MarkdownColumnSchema>

export const UriSchema = TNullable(
  Type.String({
    format: 'uri',
    maxLength: 512
  })
)
export type Uri = Static<typeof UriSchema>

export const createSlugSchema = (description: string) => {
  return Type.String({
    minLength: 2,
    maxLength: 99,
    pattern: '^[a-zA-Z0-9]+[\\-\\._a-zA-Z0-9]*$',
    description
  })
}

export const StringEnum = <T extends string[]>(
  items: [...T],
  description?: string
) => Type.Unsafe<T[number]>({ type: 'string', enum: items, description })
