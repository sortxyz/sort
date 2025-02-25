import { Type } from '@sinclair/typebox'

import { IssueStatusSchema } from '../types/kysely.type'

import { UuidSchema, DateSchema, MarkdownColumnSchema } from './api.schema'
import { LabelSchema } from './label.schema'
import { OrganizationMemberSchema } from './org-member.schema'
import { IssuePermissionsSchema } from './permissions.schema'
import { IssueRelationResponseSchema } from './relations.schema'

import type { OrganizationMember } from './org-member.schema'
import type { Static } from '@sinclair/typebox'

export const IssueTitleSchema = Type.String({ minLength: 1, maxLength: 256 })

export const IssueSchema = Type.Object({
  id: UuidSchema,
  connection_id: UuidSchema,
  database_name: Type.String(),
  created_by: UuidSchema,
  issue_number: Type.Integer(),
  title: IssueTitleSchema,
  description: Type.Optional(MarkdownColumnSchema),
  status: IssueStatusSchema,
  created_at: DateSchema,
  updated_at: DateSchema,
  labels: Type.Array(LabelSchema),
  assignees: Type.Array(OrganizationMemberSchema),
  related_change_requests: Type.Array(IssueRelationResponseSchema),
  permissions: Type.Optional(IssuePermissionsSchema)
})

export type IssueTitle = Static<typeof IssueTitleSchema>
export type Issue = Static<typeof IssueSchema>

export const IssueNumberSchema = Type.Number({
  description: 'The issue number',
  maximum: 2147483647
})

export interface AssigneesByIssueId {
  [key: string]: OrganizationMember[]
}
