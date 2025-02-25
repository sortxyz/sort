import { Type } from '@sinclair/typebox'

import { TNullable } from '../types/nullable.type'

import { DateSchema, UuidSchema } from './api.schema'

import type { Static } from '@sinclair/typebox'

export const ChangeRequestCommentContentSchema = Type.String({
  minLength: 1,
  maxLength: 500
})

export const ChangeRequestCommentSchema = Type.Object({
  id: UuidSchema,
  change_request_id: UuidSchema,
  change_id: TNullable(UuidSchema),
  review_id: TNullable(UuidSchema),
  created_by: UuidSchema,
  content: ChangeRequestCommentContentSchema,
  created_at: DateSchema,
  updated_at: DateSchema
})

export type ChangeRequestCommentContent = Static<
  typeof ChangeRequestCommentContentSchema
>
export type ChangeRequestComment = Static<typeof ChangeRequestCommentSchema>
