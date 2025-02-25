import { Type } from '@sinclair/typebox'

import { ChangeActionSchema } from '../types/kysely.type'
import { TNullable } from '../types/nullable.type'

import { DateSchema, UuidSchema, DiscriminatedUnion } from './api.schema'

import type { Static } from '@sinclair/typebox'

export type Action = Static<typeof ChangeActionSchema>

// matches kysely Numeric type
export const NumericValueSchema = Type.Union([Type.Number(), Type.String()])
export const NullableNumericValueSchema = Type.Union([
  Type.Number(),
  Type.String(),
  Type.Null()
])

export const ChangeSchema = Type.Object({
  id: Type.String(),
  change_request_id: UuidSchema,
  index: Type.Number(),
  action: ChangeActionSchema,
  connection_id: UuidSchema,
  metadata_database_name: Type.String(),
  metadata_table_name: Type.String(),
  metadata_schema_name: Type.String()
})
export type Change = Static<typeof ChangeSchema>

const BaseChangeRowSchema = {
  id: Type.String(),
  change_id: UuidSchema,
  column_name: Type.String()
}

// PKs cannot be null
export const ChangePrimaryKeySchema = Type.Object({
  ...BaseChangeRowSchema,
  string_value: Type.Optional(Type.String()),
  numeric_value: Type.Optional(NumericValueSchema),
  date_value: Type.Optional(DateSchema),
  boolean_value: Type.Optional(Type.Boolean()),
  uuid_value: Type.Optional(UuidSchema),
  json_value: Type.Optional(Type.Union([Type.Any(), Type.Not(Type.Null())])),
  binary_value: Type.Optional(Type.String({ contentEncoding: 'base64' }))
})
export type ChangePrimaryKey = Static<typeof ChangePrimaryKeySchema>

// values can be null
export const ChangeFieldValueSchema = Type.Object({
  ...BaseChangeRowSchema,
  string_value: Type.Optional(TNullable(Type.String())),
  numeric_value: Type.Optional(NullableNumericValueSchema),
  date_value: Type.Optional(TNullable(DateSchema)),
  boolean_value: Type.Optional(TNullable(Type.Boolean())),
  uuid_value: Type.Optional(TNullable(UuidSchema)),
  json_value: Type.Optional(Type.Any()),
  binary_value: Type.Optional(
    TNullable(Type.String({ contentEncoding: 'base64' }))
  ),
  is_value_null: Type.Boolean()
})
export type ChangeFieldValue = Static<typeof ChangeFieldValueSchema>

export const ChangePreviousFieldValueSchema = ChangeFieldValueSchema
export type ChangePreviousFieldValue = Static<
  typeof ChangePreviousFieldValueSchema
>

export const ChangePreviousPrimaryKeySchema = ChangePrimaryKeySchema
export type ChangePreviousPrimaryKey = Static<
  typeof ChangePreviousPrimaryKeySchema
>

// FIXME: "full" change schemas are not supposed to be used in public facing
// APIs but it is currently used in timeline responses.
export const FullChangeSchema = Type.Composite([
  ChangeSchema,
  Type.Object({
    fields: Type.Array(ChangeFieldValueSchema),
    primary_keys: Type.Array(ChangePrimaryKeySchema),
    previous_fields: Type.Optional(Type.Array(ChangeFieldValueSchema))
  })
])
export type FullChange = Static<typeof FullChangeSchema>

export const ChangeFieldValueBodySchema = Type.Omit(ChangeFieldValueSchema, [
  'id',
  'change_id'
])
export type ChangeFieldValueBody = Static<typeof ChangeFieldValueBodySchema>

export const ChangePrimaryKeyBodySchema = Type.Omit(ChangePrimaryKeySchema, [
  'id',
  'change_id'
])
export type ChangePrimaryKeyBody = Static<typeof ChangePrimaryKeyBodySchema>

// used to express either a primary key or a field value request body
export const RequestChangeFieldValueSchema = Type.Object({
  column_name: Type.String(),
  value: Type.Unknown({ description: 'Any valid JSON value' })
})
export type RequestChangeFieldValue = Static<
  typeof RequestChangeFieldValueSchema
>

export const RequestUpdateChangeSchema = Type.Partial(
  Type.Object({
    fields: Type.Array(RequestChangeFieldValueSchema),
    primary_keys: Type.Array(RequestChangeFieldValueSchema)
  }),
  { minProperties: 1 }
)

export type RequestUpdateChange = Static<typeof RequestUpdateChangeSchema>

export const RequestChangeBaseSchema = Type.Object({
  table_name: Type.String(),
  schema_name: Type.String()
})

export const RequestAddChangeSchema = Type.Composite(
  [
    RequestChangeBaseSchema,
    Type.Object({
      action: Type.Literal('ADD'),
      fields: Type.Array(RequestChangeFieldValueSchema)
    })
  ],
  {
    $id: 'RequestAddChangeSchema'
  }
)

export const RequestModifyChangeSchema = Type.Composite(
  [
    RequestChangeBaseSchema,
    Type.Object({
      action: Type.Literal('MODIFY'),
      primary_keys: Type.Array(RequestChangeFieldValueSchema),
      fields: Type.Array(RequestChangeFieldValueSchema)
    })
  ],
  {
    $id: 'RequestModifyChangeSchema'
  }
)

export const RequestDeleteChangeSchema = Type.Composite(
  [
    RequestChangeBaseSchema,
    Type.Object({
      action: Type.Literal('DELETE'),
      primary_keys: Type.Array(RequestChangeFieldValueSchema)
    })
  ],
  {
    $id: 'RequestDeleteChangeSchema'
  }
)

export const RequestChangeSchema = DiscriminatedUnion('action', [
  Type.Ref<typeof RequestAddChangeSchema>(RequestAddChangeSchema),
  Type.Ref<typeof RequestModifyChangeSchema>(RequestModifyChangeSchema),
  Type.Ref<typeof RequestDeleteChangeSchema>(RequestDeleteChangeSchema)
])
export type RequestChange = Static<typeof RequestChangeSchema>

// public facing schemas for change responses

export const ChangeValueTypeSchema = Type.Union(
  (
    [
      'string',
      'numeric',
      'date',
      'boolean',
      'json',
      'uuid',
      'binary',
      'null'
    ] as const
  ).map(n => Type.Literal(n))
)
export type ChangeValueType = Static<typeof ChangeValueTypeSchema>

export const ResponseChangeFieldSchema = Type.Object({
  column_name: Type.String(),
  value: Type.Union([
    Type.Null(),
    Type.String(),
    Type.Boolean(),
    Type.Number(),
    DateSchema,
    Type.Unknown()
  ]),
  type: ChangeValueTypeSchema
})
export type ResponseChangeField = Static<typeof ResponseChangeFieldSchema>

export const ResponseBaseAddChangeSchema = Type.Composite([
  RequestChangeBaseSchema,
  Type.Object({
    index: Type.Number(),
    id: Type.String(),
    change_request_id: Type.String(),
    database_name: Type.String()
  })
])

export const ResponseAddChangeSchema = Type.Composite(
  [
    ResponseBaseAddChangeSchema,
    Type.Object({
      action: Type.Literal('ADD'),
      fields: Type.Array(ResponseChangeFieldSchema)
    })
  ],
  {
    $id: 'ResponseAddChangeSchema'
  }
)

export const ResponseModifyChangeSchema = Type.Composite(
  [
    ResponseBaseAddChangeSchema,
    Type.Object({
      action: Type.Literal('MODIFY'),
      fields: Type.Array(ResponseChangeFieldSchema),
      primary_keys: Type.Array(ResponseChangeFieldSchema),
      previous_fields: Type.Array(ResponseChangeFieldSchema)
    })
  ],
  { $id: 'ResponseModifyChangeSchema' }
)

export const ResponseDeleteChangeSchema = Type.Composite(
  [
    ResponseBaseAddChangeSchema,
    Type.Object({
      action: Type.Literal('DELETE'),
      primary_keys: Type.Array(ResponseChangeFieldSchema),
      previous_fields: Type.Array(ResponseChangeFieldSchema)
    })
  ],
  { $id: 'ResponseDeleteChangeSchema' }
)

export const ChangeResponseSchema = DiscriminatedUnion('action', [
  Type.Ref<typeof ResponseAddChangeSchema>(ResponseAddChangeSchema),
  Type.Ref<typeof ResponseModifyChangeSchema>(ResponseModifyChangeSchema),
  Type.Ref<typeof ResponseDeleteChangeSchema>(ResponseDeleteChangeSchema)
])
export type ChangeResponse = Static<typeof ChangeResponseSchema>
