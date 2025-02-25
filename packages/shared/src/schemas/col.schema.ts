import { Type } from '@sinclair/typebox'

// Used when working with our imported schemas.
export const ColumnSchema = Type.Object({
  name: Type.String(),
  nullable: Type.Boolean(),
  type: Type.String(),
  is_primary_key: Type.Boolean(),
  has_default: Type.Boolean()
})
