import { Type } from '@sinclair/typebox'

import { TUser as UserSchema } from '../types/user.type'

import { RoleSchema } from './role.schema'

import type { Static } from '@sinclair/typebox'

export const OrganizationMemberSchema = Type.Object({
  user: Type.Pick(UserSchema, ['id', 'username', 'name', 'picture']),
  role: RoleSchema
})

export type OrganizationMember = Static<typeof OrganizationMemberSchema>
