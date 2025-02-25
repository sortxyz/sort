import { sql } from 'kysely'

import { getDb } from '../'

import { getChangeRequestRelationsByIssueIds } from './change-requests/relations.service'
import { getAssigneesByIssueIds } from './issue.service'
import * as LabelService from './label.service'

import type { Issue } from '../types/kysely.type'
import type { Selectable } from 'kysely'

type Scopes = Record<'status' | 'label' | 'assignee', Lowercase<string>[]>

export const parseQuery = (query: string) => {
  const scopes: Scopes = {
    status: [],
    label: [],
    assignee: []
  }

  // Extract quoted and unquoted query scopes like "label:'nice label'" or
  // assignee:aheckmann from the query.
  const queryTerms = query.replace(
    /(?<type>status|label|assignee):((['"])(?<quoted>.*?)\3|(?<unquoted>[^\s]+))/gm,
    (...args) => {
      const { type, quoted, unquoted } = args[args.length - 1] as {
        type: string
        quoted: string
        unquoted: string
      }
      if (Object.hasOwn(scopes, type)) {
        const value = quoted || unquoted
        if (value) {
          const lowercase = value.toLowerCase() as Lowercase<string>
          scopes[type as keyof Scopes].push(lowercase)
        }
      }
      return ''
    }
  )

  if (!scopes.status.length) scopes.status.push('open')

  return {
    phrase: queryTerms.trim(),
    scopes
  }
}

/**
 * Searches existing issues of the given connectionId and databaseName. By
 * default we return all issues. The given "query" text is parsed for scopes
 * and used to filter the issues. All remaining query text not included in a
 * scope is used to match against the issue title and description.
 *
 * Supported scopes:
 *   status:open
 *   status:closed
 *   label:'my label'
 *   assignee:username
 */
export const searchDatabaseIssues = async ({
  orgSlug,
  connectionId,
  databaseName,
  query,
  limit
}: {
  orgSlug: string
  connectionId: string
  databaseName: string
  query: string
  limit: number
}) => {
  const { phrase, scopes } = parseQuery(query)

  const wherePhrase = phrase.length
    ? sql`AND (query @@ document_title OR query @@ document_desc)`
    : sql``

  const label = scopes.label.length
    ? {
        tables: sql`, issue_label, label`,
        where: sql`AND issue.id = issue_label.issue_id
          AND label.id = issue_label.label_id
          AND LOWER(label.name) IN (${sql.join(scopes.label)})`
      }
    : {
        tables: sql``,
        where: sql``
      }

  const assignee = scopes.assignee.length
    ? {
        tables: sql`, issue_assignee, public.user`,
        where: sql`AND issue.id = issue_assignee.issue_id
          AND public.user.id = issue_assignee.user_id
          AND LOWER(public.user.username) IN (${sql.join(scopes.assignee)})`
      }
    : {
        tables: sql``,
        where: sql``
      }

  const whereState = scopes.status.length
    ? sql`AND LOWER(issue.status) IN (${sql.join(scopes.status)})`
    : sql``

  const orderBy = phrase.length
    ? sql`COALESCE(ts_rank(document_title, query), 0)
     + COALESCE(ts_rank(document_desc, query), 0)
     + COALESCE(similarity_title, 0)
     + COALESCE(similarity_desc, 0) DESC NULLS LAST`
    : sql`issue.created_at DESC`

  const builder = sql<Selectable<Issue>>`
    SELECT
      issue.*
    FROM
      issue,
      websearch_to_tsquery(${phrase}) AS query,
      to_tsvector(issue.title) AS document_title,
      to_tsvector(issue.description) AS document_desc,
      SIMILARITY(issue.title, ${phrase}) AS similarity_title,
      SIMILARITY(issue.description, ${phrase}) AS similarity_desc
      ${label.tables}
      ${assignee.tables}
    WHERE
      issue.metadata_database_connection_id = ${connectionId}
      AND issue.metadata_database_raw_name = ${databaseName}
      ${wherePhrase}
      ${whereState}
      ${assignee.where}
      ${label.where}
    GROUP BY
      issue.id,
      issue.metadata_database_connection_id,
      issue.metadata_database_raw_name,
      issue.created_by,
      issue_number,
      issue.title,
      issue.description,
      issue.status,
      issue.created_at,
      issue.updated_at,
      query,
      document_title,
      document_desc,
      similarity_title,
      similarity_desc
    ORDER BY
      ${orderBy}
    LIMIT ${limit}
  `

  let issues: Awaited<ReturnType<typeof builder.execute>>['rows']
  try {
    const result = await builder.execute(getDb())
    issues = result.rows
  } catch (err) {
    if (err instanceof Error && /invalid byte sequence/.test(err.message)) {
      return []
    }
    throw err
  }

  if (!issues.length) return []

  const issueIds = issues.map(issue => issue.id)
  const labelsByIssueId = await LabelService.getLabelsByIssueIds(issueIds)
  const assigneesByIssueId = await getAssigneesByIssueIds(orgSlug, issueIds)
  const relatedChangeRequestsByIssueId =
    await getChangeRequestRelationsByIssueIds(issueIds)

  const hydratedIssues = issues.map(issue => ({
    id: issue.id,
    connection_id: issue.metadata_database_connection_id,
    database_name: issue.metadata_database_raw_name,
    created_by: issue.created_by,
    title: issue.title,
    description: issue.description ?? null,
    issue_number: issue.issue_number,
    status: issue.status,
    labels: labelsByIssueId[issue.id] ?? [],
    assignees: assigneesByIssueId[issue.id] ?? [],
    related_change_requests: relatedChangeRequestsByIssueId[issue.id] ?? [],
    created_at: issue.created_at,
    updated_at: issue.updated_at
  }))

  return hydratedIssues
}
