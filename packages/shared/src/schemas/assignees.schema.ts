import { Type } from '@sinclair/typebox'

export const AssigneesSchema = Type.Array(
  Type.String({ minLength: 1, maxLength: 128 })
)
