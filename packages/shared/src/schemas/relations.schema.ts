import { Type } from '@sinclair/typebox'

import { DatabaseSlugSchema } from './metadata.schema'
import { OrganizationSlugSchema } from './org.schema'

import type { Static } from '@sinclair/typebox'

export const ChangeRequestRelationResponseSchema = Type.Object({
  issue_title: Type.String(),
  issue_number: Type.Number(),
  issue_id: Type.String()
})

export type ChangeRequestRelationResponse = Static<
  typeof ChangeRequestRelationResponseSchema
>

export const IssueRelationResponseSchema = Type.Object({
  change_request_title: Type.String(),
  change_request_number: Type.Number(),
  change_request_id: Type.String()
})

export type IssueRelationResponse = Static<typeof IssueRelationResponseSchema>

export const ResponseRelationSchema = Type.Object(
  {
    change_request_title: Type.String(),
    change_request_number: Type.Number(),
    issue_title: Type.String(),
    issue_number: Type.Number(),
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema
  },
  { $id: 'ResponseRelationSchema' }
)

export type ResponseRelation = Static<typeof ResponseRelationSchema>

export interface RelationsByChangeRequestId {
  [key: string]: ChangeRequestRelationResponse[]
}

export interface RelationsByIssueId {
  [key: string]: IssueRelationResponse[]
}
