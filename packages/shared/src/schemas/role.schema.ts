import { Type } from '@sinclair/typebox'

import type { Static } from '@sinclair/typebox'

export const RoleNameSchema = Type.Union([
  Type.Literal('member'),
  Type.Literal('owner')
])

export const RoleSchema = Type.Object({
  id: Type.Integer(),
  name: RoleNameSchema
})

export type RoleName = Static<typeof RoleNameSchema>

export type Role = Static<typeof RoleSchema>
