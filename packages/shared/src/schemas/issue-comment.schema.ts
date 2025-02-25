import { Type } from '@sinclair/typebox'

import { DateSchema, UuidSchema } from './api.schema'

import type { Static } from '@sinclair/typebox'

export const IssueCommentContentSchema = Type.String({
  minLength: 1,
  maxLength: 500
})

export const IssueCommentSchema = Type.Object({
  id: UuidSchema,
  issue_id: UuidSchema,
  created_by: UuidSchema,
  content: IssueCommentContentSchema,
  created_at: DateSchema,
  updated_at: DateSchema
})

export type IssueCommentContent = Static<typeof IssueCommentContentSchema>
export type IssueComment = Static<typeof IssueCommentSchema>
