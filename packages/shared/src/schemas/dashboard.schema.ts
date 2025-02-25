import { Type } from '@sinclair/typebox'

import {
  ChangeRequestStatusSchema,
  IssueStatusSchema
} from '../types/kysely.type'

import { DateSchema, UuidSchema } from './api.schema'
import { LabelSchema } from './label.schema'
import { OrganizationMemberSchema } from './org-member.schema'

import type { Static } from '@sinclair/typebox'

export const DashboardItemSchema = Type.Object({
  item_number: Type.Number(),
  id: UuidSchema,
  item_type: Type.Union([
    Type.Literal('issue'),
    Type.Literal('change_request')
  ]),
  title: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  status: Type.Union([IssueStatusSchema, ChangeRequestStatusSchema]),
  database_name: Type.String(),
  database_slug: Type.String(),
  created_at: DateSchema,
  updated_at: DateSchema,
  created_by: Type.String()
})

export type DashboardItem = Static<typeof DashboardItemSchema>

export const HydratedDashboardItemSchema = Type.Intersect([
  DashboardItemSchema,
  Type.Object({
    labels: Type.Array(LabelSchema),
    assignees: Type.Array(OrganizationMemberSchema),
    reviewers: Type.Array(OrganizationMemberSchema)
  })
])

export type HydratedDashboardItem = Static<typeof HydratedDashboardItemSchema>
