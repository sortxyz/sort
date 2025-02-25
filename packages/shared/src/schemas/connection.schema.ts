import { Type } from '@sinclair/typebox'

import { TNullable } from '../types/nullable.type'

import { DateSchema, UuidSchema, StringEnum } from './api.schema'
import { ConnectionDataProviderSchema } from './data-provider.schema'

import type { ConnectionSelect } from '../types/kysely/connection/connection.type'
import type { Static } from '@sinclair/typebox'

export const VisibilitySchema = StringEnum(
  ['private', 'public'],
  'Default: private'
)

export const ConnectionStringSchema = Type.String({
  maxLength: 1024,
  minLength: 2
})

export const ConnectionNameSchema = Type.String({
  maxLength: 128,
  minLength: 2,
  description:
    'The name of the connection. Required when `read_only` is `false`.'
})

export const WarehouseSchema = Type.String({
  minLength: 1,
  description: 'Required when `data_provider` is `snowflake`.'
})

export const ConnectionSchema = Type.Object({
  name: ConnectionNameSchema,
  data_provider: ConnectionDataProviderSchema,
  id: UuidSchema,
  organization_id: UuidSchema,
  connection_string: ConnectionStringSchema,
  created_at: DateSchema,
  created_by: UuidSchema,
  with_ssl: Type.Boolean(),
  visibility: VisibilitySchema,
  readonly_connection_id: TNullable(UuidSchema),
  warehouse: TNullable(WarehouseSchema)
})

// NOTE: We do not return the connection_string field in any Response.
// These values are encrypted and sensitive.
export const ConnectionResponseSchema = Type.Omit(ConnectionSchema, [
  'connection_string'
])

export const ConnectionTestSchema = Type.Object({
  success: Type.Boolean(),
  message: Type.String()
})

export const ConnectionSuccessSchema = Type.Object({
  success: Type.Boolean()
})

export type ConnectionSuccess = Static<typeof ConnectionSuccessSchema>

export type Connection = Static<typeof ConnectionSchema>

export type ConnectionServiceTest = Pick<
  ConnectionSelect,
  'connection_string' | 'with_ssl' | 'warehouse' | 'visibility'
>
