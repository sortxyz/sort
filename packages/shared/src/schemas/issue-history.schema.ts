import { Type } from '@sinclair/typebox'

import { DateSchema, MarkdownColumnSchema, UuidSchema } from './api.schema'
import { IssueCommentContentSchema } from './issue-comment.schema'
import { IssueTitleSchema } from './issue.schema'
import { LabelSchema } from './label.schema'
import { OrganizationMemberSchema } from './org-member.schema'
import { IssueCommentPermissionsSchema } from './permissions.schema'
import { ProfileSchema } from './user.schema'

import type { Static } from '@sinclair/typebox'

export const ActionDetailsCommentSchema = Type.Object({
  comment_id: UuidSchema,
  content: IssueCommentContentSchema
})
export const ActionDetailsLabelSchema = Type.Object({ label: LabelSchema })
export type ActionDetailsLabel = Static<typeof ActionDetailsLabelSchema>
export const ActionDetailsAssigneeSchema = Type.Object({
  assignee: OrganizationMemberSchema
})
export type ActionDetailsAssignee = Static<typeof ActionDetailsAssigneeSchema>
export const ActionDetailsIssueSchema = Type.Object({
  issue_number: Type.Integer()
})
export const ActionDetailsUpdateTitleSchema = Type.Object({
  prev: IssueTitleSchema,
  curr: IssueTitleSchema
})
export const ActionDetailsUpdateDescriptionSchema = Type.Object({
  prev: MarkdownColumnSchema,
  curr: MarkdownColumnSchema
})

export const ActionDetailsSchema = Type.Union([
  ActionDetailsIssueSchema,
  ActionDetailsUpdateTitleSchema,
  ActionDetailsUpdateDescriptionSchema,
  ActionDetailsLabelSchema,
  ActionDetailsAssigneeSchema,
  ActionDetailsCommentSchema
])

export type ActionDetails = Static<typeof ActionDetailsSchema>

const IssueHistoryUserSchema = Type.Required(
  Type.Pick(ProfileSchema, ['id', 'username', 'name', 'picture'])
)

export const IssueHistoryAddCommentSchema = Type.Object({
  id: UuidSchema,
  issue_id: UuidSchema,
  user: IssueHistoryUserSchema,
  action_type: Type.Literal('ADD_COMMENT'),
  action_details: ActionDetailsCommentSchema,
  created_at: DateSchema,
  permissions: Type.Optional(IssueCommentPermissionsSchema)
})

export const IssueHistoryUpdateCommentSchema = Type.Object({
  id: UuidSchema,
  issue_id: UuidSchema,
  user: IssueHistoryUserSchema,
  action_type: Type.Literal('UPDATE_COMMENT'),
  action_details: ActionDetailsCommentSchema,
  created_at: DateSchema,
  permissions: Type.Optional(IssueCommentPermissionsSchema)
})

export const IssueHistoryRemoveCommentSchema = Type.Object({
  id: UuidSchema,
  issue_id: UuidSchema,
  user: IssueHistoryUserSchema,
  action_type: Type.Literal('REMOVE_COMMENT'),
  action_details: ActionDetailsCommentSchema,
  created_at: DateSchema
})

export const IssueTimelineCommentSchema = Type.Union([
  IssueHistoryAddCommentSchema,
  IssueHistoryUpdateCommentSchema,
  IssueHistoryRemoveCommentSchema
])

export const IssueHistorySchema = Type.Union([
  Type.Object({
    id: UuidSchema,
    issue_id: UuidSchema,
    user: IssueHistoryUserSchema,
    action_type: Type.Literal('CREATE_ISSUE'),
    action_details: ActionDetailsIssueSchema,
    created_at: DateSchema
  }),
  Type.Object({
    id: UuidSchema,
    issue_id: UuidSchema,
    user: IssueHistoryUserSchema,
    action_type: Type.Literal('CLOSE_ISSUE'),
    action_details: ActionDetailsIssueSchema,
    created_at: DateSchema
  }),
  Type.Object({
    id: UuidSchema,
    issue_id: UuidSchema,
    user: IssueHistoryUserSchema,
    action_type: Type.Literal('REOPEN_ISSUE'),
    action_details: ActionDetailsIssueSchema,
    created_at: DateSchema
  }),
  Type.Object({
    id: UuidSchema,
    issue_id: UuidSchema,
    user: IssueHistoryUserSchema,
    action_type: Type.Literal('UPDATE_TITLE'),
    action_details: ActionDetailsUpdateTitleSchema,
    created_at: DateSchema
  }),
  Type.Object({
    id: UuidSchema,
    issue_id: UuidSchema,
    user: IssueHistoryUserSchema,
    action_type: Type.Literal('UPDATE_DESCRIPTION'),
    action_details: ActionDetailsUpdateDescriptionSchema,
    created_at: DateSchema
  }),
  Type.Object({
    id: UuidSchema,
    issue_id: UuidSchema,
    user: IssueHistoryUserSchema,
    action_type: Type.Literal('ADD_LABEL'),
    action_details: ActionDetailsLabelSchema,
    created_at: DateSchema
  }),
  Type.Object({
    id: UuidSchema,
    issue_id: UuidSchema,
    user: IssueHistoryUserSchema,
    action_type: Type.Literal('REMOVE_LABEL'),
    action_details: ActionDetailsLabelSchema,
    created_at: DateSchema
  }),
  Type.Object({
    id: UuidSchema,
    issue_id: UuidSchema,
    user: IssueHistoryUserSchema,
    action_type: Type.Literal('ADD_ASSIGNEE'),
    action_details: ActionDetailsAssigneeSchema,
    created_at: DateSchema
  }),
  Type.Object({
    id: UuidSchema,
    issue_id: UuidSchema,
    user: IssueHistoryUserSchema,
    action_type: Type.Literal('REMOVE_ASSIGNEE'),
    action_details: ActionDetailsAssigneeSchema,
    created_at: DateSchema
  }),
  IssueHistoryAddCommentSchema,
  IssueHistoryUpdateCommentSchema,
  IssueHistoryRemoveCommentSchema
])

export type IssueHistoryAddComment = Static<typeof IssueHistoryAddCommentSchema>
export type IssueHistoryUpdateComment = Static<
  typeof IssueHistoryUpdateCommentSchema
>
export type IssueHistoryRemoveComment = Static<
  typeof IssueHistoryRemoveCommentSchema
>
export type IssueTimelineComment = Static<typeof IssueTimelineCommentSchema>
export type IssueHistory = Static<typeof IssueHistorySchema>
