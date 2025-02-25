import { Type } from '@sinclair/typebox'

import { TNullable } from '../types/nullable.type'

import { UuidSchema } from './api.schema'

import type { Static } from '@sinclair/typebox'

export const LabelIdSchema = Type.String({
  format: 'uuid',
  description: 'The uuid of a Label'
})

export const LabelNameSchema = Type.String({
  minLength: 1,
  maxLength: 16,
  pattern: '^[^"]+$'
})
export const LabelDescriptionSchema = TNullable(Type.String())
export const LabelColorSchema = Type.String({
  minLength: 7,
  maxLength: 7,
  pattern: '^#[0-9a-fA-F]{6}$' // hex code
})
export const LabelDatabaseRawNameSchema = Type.String({
  minLength: 1,
  maxLength: 64
})
export const LabelDatabaseConnectionIdSchema = UuidSchema

export const LabelSchema = Type.Object({
  id: LabelIdSchema,
  name: LabelNameSchema,
  description: LabelDescriptionSchema,
  connection_id: LabelDatabaseConnectionIdSchema,
  database_name: LabelDatabaseRawNameSchema,
  color: LabelColorSchema
})

export type Label = Static<typeof LabelSchema>

export interface LabelsByKey {
  [key: string]: Label[]
}
