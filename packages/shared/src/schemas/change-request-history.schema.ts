import { Type } from '@sinclair/typebox'

import { ReviewEventTypeSchema } from '../types/kysely.type'
import { TNullable } from '../types/nullable.type'

import {
  DateSchema,
  DiscriminatedUnion,
  MarkdownColumnSchema,
  UuidSchema
} from './api.schema'
import { ChangeRequestCommentContentSchema } from './change-request-comment.schema'
import { ChangeRequestTitleSchema } from './change-request.schema'
import { FullChangeSchema } from './change.schema'
import { LabelSchema } from './label.schema'
import { OrganizationMemberSchema } from './org-member.schema'
import { ChangeRequestCommentPermissionsSchema } from './permissions.schema'
import { ProfileSchema } from './user.schema'

import type { Static } from '@sinclair/typebox'

export const ActionDetailsCommentSchema = Type.Object({
  comment_id: UuidSchema,
  change_id: TNullable(UuidSchema),
  review_id: TNullable(UuidSchema),
  content: ChangeRequestCommentContentSchema
})
export type ActionDetailsComment = Static<typeof ActionDetailsCommentSchema>
export const ActionDetailsLabelSchema = Type.Object({ label: LabelSchema })
export type ActionDetailsLabel = Static<typeof ActionDetailsLabelSchema>
export const ActionDetailsReviewerSchema = Type.Object({
  reviewer: OrganizationMemberSchema
})
export type ActionDetailsReviewer = Static<typeof ActionDetailsReviewerSchema>
export const ActionDetailsChangeRequestSchema = Type.Object({
  change_request_number: Type.Integer()
})
export const ActionDetailsUpdateTitleSchema = Type.Object({
  prev: ChangeRequestTitleSchema,
  curr: ChangeRequestTitleSchema
})
export const ActionDetailsUpdateDescriptionSchema = Type.Object({
  prev: MarkdownColumnSchema,
  curr: MarkdownColumnSchema
})
export const ActionDetailsReviewSchema = Type.Object({
  review_id: UuidSchema,
  event_type: ReviewEventTypeSchema,
  text: TNullable(Type.String())
})
export type ActionDetailsReview = Static<typeof ActionDetailsReviewSchema>
const ActionDetailsJobSchema = Type.Object({
  change_request_job_id: UuidSchema
})
const ActionDetailsJobFailureSchema = Type.Object({
  change_request_job_id: UuidSchema,
  reason: Type.String(),
  code: Type.String(),
  sql: Type.Optional(Type.String())
})
const ActionDetailsJobCompleteSchema = Type.Object({
  change_request_job_id: UuidSchema,
  num_affected_rows: Type.Integer()
})

export const ActionDetailsChangeSchema = Type.Object({
  change: FullChangeSchema
})

export const ActionDetailsUpdateChangeSchema = Type.Object({
  previous_change: FullChangeSchema,
  change: FullChangeSchema
})

export const ActionDetailsSchema = Type.Union([
  ActionDetailsChangeRequestSchema,
  ActionDetailsUpdateTitleSchema,
  ActionDetailsUpdateDescriptionSchema,
  ActionDetailsLabelSchema,
  ActionDetailsReviewerSchema,
  ActionDetailsCommentSchema,
  ActionDetailsReviewSchema,
  ActionDetailsJobSchema,
  ActionDetailsJobFailureSchema,
  ActionDetailsJobCompleteSchema,
  ActionDetailsChangeSchema,
  ActionDetailsUpdateChangeSchema
])

export type ActionDetails = Static<typeof ActionDetailsSchema>

const ChangeRequestHistoryUserSchema = Type.Required(
  Type.Pick(ProfileSchema, ['id', 'username', 'name', 'picture'])
)

export const ChangeRequestHistoryAddCommentSchema = Type.Object({
  id: UuidSchema,
  change_request_id: UuidSchema,
  user: ChangeRequestHistoryUserSchema,
  action_type: Type.Literal('ADD_COMMENT'),
  action_details: ActionDetailsCommentSchema,
  created_at: DateSchema,
  permissions: Type.Optional(ChangeRequestCommentPermissionsSchema)
})

export const ChangeRequestHistoryUpdateCommentSchema = Type.Object({
  id: UuidSchema,
  change_request_id: UuidSchema,
  user: ChangeRequestHistoryUserSchema,
  action_type: Type.Literal('UPDATE_COMMENT'),
  action_details: ActionDetailsCommentSchema,
  created_at: DateSchema,
  permissions: Type.Optional(ChangeRequestCommentPermissionsSchema)
})

export const ChangeRequestHistoryRemoveCommentSchema = Type.Object({
  id: UuidSchema,
  change_request_id: UuidSchema,
  user: ChangeRequestHistoryUserSchema,
  action_type: Type.Literal('REMOVE_COMMENT'),
  action_details: ActionDetailsCommentSchema,
  created_at: DateSchema
})

export const ChangeRequestTimelineCommentSchema = Type.Union([
  ChangeRequestHistoryAddCommentSchema,
  ChangeRequestHistoryUpdateCommentSchema,
  ChangeRequestHistoryRemoveCommentSchema
])

export const ChangeRequestHistoryAddReviewSchema = Type.Object({
  id: UuidSchema,
  change_request_id: UuidSchema,
  user: ChangeRequestHistoryUserSchema,
  action_type: Type.Literal('ADD_REVIEW'),
  action_details: ActionDetailsReviewSchema,
  created_at: DateSchema
})

export const ChangeRequestHistoryUpdateReviewSchema = Type.Object({
  id: UuidSchema,
  change_request_id: UuidSchema,
  user: ChangeRequestHistoryUserSchema,
  action_type: Type.Literal('UPDATE_REVIEW'),
  action_details: ActionDetailsReviewSchema,
  created_at: DateSchema
})

export const ChangeRequestAddChangeSchema = Type.Object({
  id: UuidSchema,
  change_request_id: UuidSchema,
  user: ChangeRequestHistoryUserSchema,
  action_type: Type.Literal('ADD_CHANGE'),
  action_details: ActionDetailsChangeSchema,
  created_at: DateSchema
})

export const ChangeRequestUpdateChangeSchema = Type.Object({
  id: UuidSchema,
  change_request_id: UuidSchema,
  user: ChangeRequestHistoryUserSchema,
  action_type: Type.Literal('UPDATE_CHANGE'),
  action_details: ActionDetailsUpdateChangeSchema,
  created_at: DateSchema
})

export const ChangeRequestDeleteChangeSchema = Type.Object({
  id: UuidSchema,
  change_request_id: UuidSchema,
  user: ChangeRequestHistoryUserSchema,
  action_type: Type.Literal('DELETE_CHANGE'),
  action_details: ActionDetailsChangeSchema,
  created_at: DateSchema
})

export const ChangeRequestHistorySchema = DiscriminatedUnion('action_type', [
  Type.Object({
    id: UuidSchema,
    change_request_id: UuidSchema,
    user: ChangeRequestHistoryUserSchema,
    action_type: Type.Literal('CREATE_CHANGE_REQUEST'),
    action_details: ActionDetailsChangeRequestSchema,
    created_at: DateSchema
  }),
  Type.Object({
    id: UuidSchema,
    change_request_id: UuidSchema,
    user: ChangeRequestHistoryUserSchema,
    action_type: Type.Literal('CLOSE_CHANGE_REQUEST'),
    action_details: ActionDetailsChangeRequestSchema,
    created_at: DateSchema
  }),
  Type.Object({
    id: UuidSchema,
    change_request_id: UuidSchema,
    user: ChangeRequestHistoryUserSchema,
    action_type: Type.Literal('REOPEN_CHANGE_REQUEST'),
    action_details: ActionDetailsChangeRequestSchema,
    created_at: DateSchema
  }),
  Type.Object({
    id: UuidSchema,
    change_request_id: UuidSchema,
    user: ChangeRequestHistoryUserSchema,
    action_type: Type.Literal('UPDATE_TITLE'),
    action_details: ActionDetailsUpdateTitleSchema,
    created_at: DateSchema
  }),
  Type.Object({
    id: UuidSchema,
    change_request_id: UuidSchema,
    user: ChangeRequestHistoryUserSchema,
    action_type: Type.Literal('UPDATE_DESCRIPTION'),
    action_details: ActionDetailsUpdateDescriptionSchema,
    created_at: DateSchema
  }),
  Type.Object({
    id: UuidSchema,
    change_request_id: UuidSchema,
    user: ChangeRequestHistoryUserSchema,
    action_type: Type.Literal('ADD_LABEL'),
    action_details: ActionDetailsLabelSchema,
    created_at: DateSchema
  }),
  Type.Object({
    id: UuidSchema,
    change_request_id: UuidSchema,
    user: ChangeRequestHistoryUserSchema,
    action_type: Type.Literal('REMOVE_LABEL'),
    action_details: ActionDetailsLabelSchema,
    created_at: DateSchema
  }),
  Type.Object({
    id: UuidSchema,
    change_request_id: UuidSchema,
    user: ChangeRequestHistoryUserSchema,
    action_type: Type.Literal('ADD_REVIEWER'),
    action_details: ActionDetailsReviewerSchema,
    created_at: DateSchema
  }),
  Type.Object({
    id: UuidSchema,
    change_request_id: UuidSchema,
    user: ChangeRequestHistoryUserSchema,
    action_type: Type.Literal('REMOVE_REVIEWER'),
    action_details: ActionDetailsReviewerSchema,
    created_at: DateSchema
  }),
  Type.Object({
    id: UuidSchema,
    change_request_id: UuidSchema,
    user: ChangeRequestHistoryUserSchema,
    action_type: Type.Literal('START_EXECUTE'),
    action_details: ActionDetailsJobSchema,
    created_at: DateSchema
  }),
  Type.Object({
    id: UuidSchema,
    change_request_id: UuidSchema,
    user: ChangeRequestHistoryUserSchema,
    action_type: Type.Literal('FAIL_EXECUTE'),
    action_details: ActionDetailsJobFailureSchema,
    created_at: DateSchema
  }),
  Type.Object({
    id: UuidSchema,
    change_request_id: UuidSchema,
    user: ChangeRequestHistoryUserSchema,
    action_type: Type.Literal('COMPLETE_EXECUTE'),
    action_details: ActionDetailsJobCompleteSchema,
    created_at: DateSchema
  }),
  ChangeRequestHistoryAddCommentSchema,
  ChangeRequestHistoryUpdateCommentSchema,
  ChangeRequestHistoryRemoveCommentSchema,
  ChangeRequestHistoryAddReviewSchema,
  ChangeRequestHistoryUpdateReviewSchema,
  ChangeRequestAddChangeSchema,
  ChangeRequestUpdateChangeSchema,
  ChangeRequestDeleteChangeSchema
])

export type ChangeRequestHistoryAddComment = Static<
  typeof ChangeRequestHistoryAddCommentSchema
>
export type ChangeRequestHistoryUpdateComment = Static<
  typeof ChangeRequestHistoryUpdateCommentSchema
>
export type ChangeRequestHistoryRemoveComment = Static<
  typeof ChangeRequestHistoryRemoveCommentSchema
>
export type ChangeRequestTimelineComment = Static<
  typeof ChangeRequestTimelineCommentSchema
>
export type ChangeRequestHistoryAddReview = Static<
  typeof ChangeRequestHistoryAddReviewSchema
>
export type ChangeRequestHistoryUpdateReview = Static<
  typeof ChangeRequestHistoryUpdateReviewSchema
>
export type ChangeRequestHistory = Static<typeof ChangeRequestHistorySchema>
