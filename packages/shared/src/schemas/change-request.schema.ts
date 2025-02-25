import { Type } from '@sinclair/typebox'

import { ChangeRequestStatusSchema } from '../types/kysely.type'

import { UuidSchema, DateSchema, MarkdownColumnSchema } from './api.schema'
import { AssigneesSchema } from './assignees.schema'
import { ChangeResponseSchema, RequestChangeSchema } from './change.schema'
import { LabelSchema, LabelIdSchema } from './label.schema'
import { OrganizationMemberSchema } from './org-member.schema'
import { ChangeRequestPermissionsSchema } from './permissions.schema'
import { ChangeRequestRelationResponseSchema } from './relations.schema'

import type { Static } from '@sinclair/typebox'

export const ChangeRequestTitleSchema = Type.String({
  minLength: 2,
  maxLength: 256
})
export type ChangeRequestTitle = Static<typeof ChangeRequestTitleSchema>

export const CreateChangeRequestBodySchema = Type.Object({
  title: ChangeRequestTitleSchema,
  description: Type.Optional(MarkdownColumnSchema),
  labels: Type.Optional(Type.Array(LabelIdSchema)),
  reviewers: Type.Optional(AssigneesSchema),
  changes: Type.Optional(Type.Array(RequestChangeSchema)),
  related_issues: Type.Optional(Type.Array(Type.Number()))
})
export type CreateChangeRequestBody = Static<
  typeof CreateChangeRequestBodySchema
>

export const FullChangeRequestResponseSchema = Type.Object({
  id: UuidSchema,
  connection_id: UuidSchema,
  database_name: Type.String(),
  created_by: UuidSchema,
  change_request_number: Type.Integer(),
  title: ChangeRequestTitleSchema,
  description: MarkdownColumnSchema,
  status: ChangeRequestStatusSchema,
  created_at: DateSchema,
  updated_at: DateSchema,
  labels: Type.Array(LabelSchema),
  reviewers: Type.Array(OrganizationMemberSchema),
  permissions: Type.Optional(ChangeRequestPermissionsSchema),
  changes: Type.Array(ChangeResponseSchema),
  related_issues: Type.Array(ChangeRequestRelationResponseSchema)
})
export type FullChangeRequestResponse = Static<
  typeof FullChangeRequestResponseSchema
>

export const ChangeRequestSearchResponseSchema = Type.Omit(
  FullChangeRequestResponseSchema,
  ['changes']
)
export type ChangeRequestSearchResponse = Static<
  typeof ChangeRequestSearchResponseSchema
>

export const UpdateChangeRequestBodySchema = Type.Partial(
  Type.Object({
    title: ChangeRequestTitleSchema,
    description: Type.Optional(MarkdownColumnSchema),
    status: Type.Union([Type.Literal('open'), Type.Literal('closed')]),
    labels: Type.Array(LabelIdSchema),
    reviewers: AssigneesSchema,
    related_issues: Type.Array(Type.Number())
  }),
  { minProperties: 1 }
)

export const ChangeRequestNumberSchema = Type.Number({
  description: 'The change request number',
  maximum: 2147483647
})
