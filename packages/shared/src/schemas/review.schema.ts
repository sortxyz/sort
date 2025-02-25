import { Type } from '@sinclair/typebox'

import { ReviewEventTypeSchema } from '../types/kysely.type'

import { UuidSchema, DateSchema, MarkdownColumnSchema } from './api.schema'
import { ReviewPermissionsSchema } from './permissions.schema'

import type { Static } from '@sinclair/typebox'

export const ReviewSchema = Type.Object({
  id: UuidSchema,
  change_request_id: UuidSchema,
  event_type: ReviewEventTypeSchema,
  text: Type.Optional(MarkdownColumnSchema),
  is_active: Type.Boolean(),
  created_by: UuidSchema,
  created_at: DateSchema,
  updated_at: DateSchema,
  permissions: Type.Optional(ReviewPermissionsSchema)
})

export type Review = Static<typeof ReviewSchema>
