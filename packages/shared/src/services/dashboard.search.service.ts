import { sql } from 'kysely'

import { getDb } from '..'

import { getReviewersByChangeRequestIds } from './change-requests/change-request.service'
import { getAssigneesByIssueIds } from './issue.service'
import * as LabelService from './label.service'

import type {
  DashboardItem,
  HydratedDashboardItem
} from '../schemas/dashboard.schema'
import type { AssigneesByIssueId } from '../schemas/issue.schema'
import type { LabelsByKey } from '../schemas/label.schema'
import type { Organization } from '../schemas/org.schema'
import type { ReviewersByChangeRequestId } from './change-requests/change-request.service'
import type { SortContext } from '../types/sort-context.type'
import type { Selectable } from 'kysely'

export const getDashboard = async ({
  org,
  itemType,
  status,
  context,
  limit = 20
}: {
  org: Organization
  status?: 'open' | 'closed'
  itemType?: 'issues' | 'change_requests'
  context: SortContext
  limit?: number
}) => {
  const innerSql = []

  let visibilityClause = ''
  if (context.isCustomerAccount) {
    visibilityClause = `
      AND (
        connection.visibility = 'public' OR (
          connection.visibility = 'private'
          AND organization_user.user_id = '${context.user.id}'
        )
      )
    `
  } else {
    visibilityClause = "AND connection.visibility = 'public'"
  }

  if (itemType === 'issues' || !itemType) {
    let issueStatusClause = ''
    if (status) {
      issueStatusClause = `AND status = '${status}'`
    }

    innerSql.push(`
    SELECT DISTINCT
      'issue' as item_type,
      issue.id,
      issue.title,
      issue.description,
      issue.status,
      issue.metadata_database_raw_name as database_name,
      metadata_database.slug as database_slug,
      issue.created_at,
      issue.updated_at,
      issue.issue_number as item_number,
      issue.created_by
    FROM
      issue,
      connection,
      metadata_database,
      organization_user
    WHERE
      connection.organization_id = '${org.id}'
      AND organization_user.organization_id = connection.organization_id
      AND issue.metadata_database_connection_id = connection.id
      AND issue.metadata_database_raw_name = metadata_database.raw_name
      AND issue.metadata_database_connection_id = metadata_database.connection_id
      ${visibilityClause}
      ${issueStatusClause}
  `)
  }

  if (itemType === 'change_requests' || !itemType) {
    let changeRequestStatusClause = ''
    if (status) {
      changeRequestStatusClause =
        status === 'open'
          ? "AND (status IN ('open', 'approved', 'executing'))"
          : "AND (status IN ('closed', 'applied'))"
    }

    innerSql.push(`
    SELECT DISTINCT
      'change_request' as item_type,
      change_request.id,
      change_request.title,
      change_request.description,
      change_request.status,
      change_request.metadata_database_raw_name as database_name,
      metadata_database.slug as database_slug,
      change_request.created_at,
      change_request.updated_at,
      change_request.change_request_number as item_number,
      change_request.created_by
    FROM
      change_request,
      connection,
      metadata_database,
      organization_user
    WHERE
      connection.organization_id = '${org.id}'
      AND organization_user.organization_id = connection.organization_id
      AND change_request.metadata_database_connection_id = connection.id
      AND change_request.metadata_database_raw_name = metadata_database.raw_name
      AND change_request.metadata_database_connection_id = metadata_database.connection_id
      ${visibilityClause}
      ${changeRequestStatusClause}
    `)
  }

  const builder = sql.raw<Selectable<DashboardItem>>(`
    SELECT * FROM (${innerSql.join(' UNION ALL ')}) as dashboard
    ORDER BY updated_at DESC
    LIMIT ${limit};
  `)

  let dashboardItems: Awaited<ReturnType<typeof builder.execute>>['rows']
  try {
    const result = await builder.execute(getDb())
    dashboardItems = result.rows
  } catch (err) {
    if (err instanceof Error && /invalid byte sequence/.test(err.message)) {
      return []
    }
    throw err
  }

  // hydrate issues with labels and assignees
  let labelsByIssueId: LabelsByKey
  let assigneesByIssueId: AssigneesByIssueId
  if (dashboardItems.some(item => item.item_type === 'issue')) {
    const issueIds = dashboardItems
      .filter(item => item.item_type === 'issue')
      .map(item => item.id)
    labelsByIssueId = await LabelService.getLabelsByIssueIds(issueIds)
    assigneesByIssueId = await getAssigneesByIssueIds(org.slug, issueIds)
  }

  let labelsByChangeRequestId: LabelsByKey
  let reviewersByChangeRequestId: ReviewersByChangeRequestId
  if (dashboardItems.some(item => item.item_type === 'change_request')) {
    const changeRequestIds = dashboardItems
      .filter(item => item.item_type === 'change_request')
      .map(item => item.id)
    labelsByChangeRequestId =
      await LabelService.getLabelsByChangeRequestIds(changeRequestIds)
    reviewersByChangeRequestId = await getReviewersByChangeRequestIds(
      org.slug,
      changeRequestIds
    )
  }

  const changeRequestHydratedItems = dashboardItems
    .filter(item => item.item_type === 'change_request')
    .map<HydratedDashboardItem>(
      item =>
        ({
          ...item,
          labels: labelsByChangeRequestId[item.id] ?? [],
          assignees: [],
          reviewers: reviewersByChangeRequestId[item.id] ?? []
        }) satisfies HydratedDashboardItem
    )

  const hydratedDashboardItems = dashboardItems
    .filter(item => item.item_type === 'issue')
    .map<HydratedDashboardItem>(
      item =>
        ({
          ...item,
          labels: labelsByIssueId[item.id] ?? [],
          assignees: assigneesByIssueId[item.id] ?? [],
          reviewers: []
        }) satisfies HydratedDashboardItem
    )

  return hydratedDashboardItems
    .concat(changeRequestHydratedItems)
    .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime())
}
