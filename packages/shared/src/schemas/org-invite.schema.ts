import { Type } from '@sinclair/typebox'

import { OrganizationInviteStatusSchema } from '../types/kysely.type'

import { EmailSchema, UuidSchema, DateSchema } from './api.schema'

import type { Static } from '@sinclair/typebox'

export const OrganizationInviteNameSchema = Type.String({
  minLength: 2,
  maxLength: 128
})

export { OrganizationInviteStatusSchema }

export const OrganizationInviteSchema = Type.Object({
  created_at: DateSchema,
  created_by: Type.String(),
  email: EmailSchema,
  id: UuidSchema,
  name: OrganizationInviteNameSchema,
  organization_id: UuidSchema,
  role_id: Type.Integer(),
  status: OrganizationInviteStatusSchema
})

export type OrganizationInvite = Static<typeof OrganizationInviteSchema>
