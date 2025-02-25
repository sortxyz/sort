import { sql } from 'kysely'

import { getDb } from '../../'
import * as LabelService from '../label.service'

import { getReviewersByChangeRequestIds } from './change-request.service'
import { getIssueRelationsByChangeRequestIds } from './relations.service'

import type { ChangeRequest } from '../../types/kysely.type'
import type { Selectable } from 'kysely'

type Scopes = Record<'status' | 'label' | 'reviewer', Lowercase<string>[]>

export const parseQuery = (query: string) => {
  const scopes: Scopes = {
    status: [],
    label: [],
    reviewer: []
  }

  // Extract quoted and unquoted query scopes like "label:'nice label'" or
  // reviewer:aheckmann from the query.
  const queryTerms = query.replace(
    /(?<type>status|label|reviewer):((['"])(?<quoted>.*?)\3|(?<unquoted>[^\s]+))/gm,
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

  if (
    !scopes.status.length ||
    (scopes.status.length === 1 && scopes.status[0] === 'open')
  ) {
    scopes.status = ['open', 'approved', 'executing']
  } else if (scopes.status.length === 1 && scopes.status[0] === 'closed') {
    scopes.status = ['closed', 'applied']
  }

  return {
    phrase: queryTerms.trim(),
    scopes
  }
}

/**
 * Searches existing change requests of the given connectionId and databaseName. By
 * default we return all change requests. The given "query" text is parsed for scopes
 * and used to filter the change requests. All remaining query text not included in a
 * scope is used to match against the change request title and description.
 *
 * Supported scopes:
 *   status:open
 *   status:closed
 *   label:'my label'
 *   reviewer:username
 */
export const searchDatabaseChangeRequests = async ({
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
        tables: sql`, change_request_label, label`,
        where: sql`AND change_request.id = change_request_label.change_request_id
          AND label.id = change_request_label.label_id
          AND LOWER(label.name) IN (${sql.join(scopes.label)})`
      }
    : {
        tables: sql``,
        where: sql``
      }

  const reviewer = scopes.reviewer.length
    ? {
        tables: sql`, change_request_reviewer, public.user`,
        where: sql`AND change_request.id = change_request_reviewer.change_request_id
          AND public.user.id = change_request_reviewer.user_id
          AND LOWER(public.user.username) IN (${sql.join(scopes.reviewer)})`
      }
    : {
        tables: sql``,
        where: sql``
      }

  const whereState = scopes.status.length
    ? sql`AND LOWER(change_request.status) IN (${sql.join(scopes.status)})`
    : sql``

  const orderBy = phrase.length
    ? sql`COALESCE(ts_rank(document_title, query), 0)
     + COALESCE(ts_rank(document_desc, query), 0)
     + COALESCE(similarity_title, 0)
     + COALESCE(similarity_desc, 0) DESC NULLS LAST`
    : sql`change_request.created_at DESC`

  const builder = sql<Selectable<ChangeRequest>>`
    SELECT
      change_request.*
    FROM
      change_request,
      websearch_to_tsquery(${phrase}) AS query,
      to_tsvector(change_request.title) AS document_title,
      to_tsvector(change_request.description) AS document_desc,
      SIMILARITY(change_request.title, ${phrase}) AS similarity_title,
      SIMILARITY(change_request.description, ${phrase}) AS similarity_desc
      ${label.tables}
      ${reviewer.tables}
    WHERE
      change_request.metadata_database_connection_id = ${connectionId}
      AND change_request.metadata_database_raw_name = ${databaseName}
      ${wherePhrase}
      ${whereState}
      ${reviewer.where}
      ${label.where}
    GROUP BY
      change_request.id,
      change_request.metadata_database_connection_id,
      change_request.metadata_database_raw_name,
      change_request.created_by,
      change_request_number,
      change_request.title,
      change_request.description,
      change_request.status,
      change_request.created_at,
      change_request.updated_at,
      query,
      document_title,
      document_desc,
      similarity_title,
      similarity_desc
    ORDER BY
      ${orderBy}
    LIMIT ${limit}
  `

  let changeRequests: Awaited<ReturnType<typeof builder.execute>>['rows']
  try {
    const result = await builder.execute(getDb())
    changeRequests = result.rows
  } catch (err) {
    if (err instanceof Error && /invalid byte sequence/.test(err.message)) {
      return []
    }
    throw err
  }

  if (!changeRequests.length) return []

  const changeRequestIds = changeRequests.map(changeRequest => changeRequest.id)
  const labelsByChangeRequestId =
    await LabelService.getLabelsByChangeRequestIds(changeRequestIds)
  const reviewersByChangeRequestId = await getReviewersByChangeRequestIds(
    orgSlug,
    changeRequestIds
  )
  const relatedIssuesByChangeRequestId =
    await getIssueRelationsByChangeRequestIds(changeRequestIds)

  // intentionally not fetching changes here to keep response times snappier. if
  // the client needs it they can call the getChanges endpoint.

  const hydratedChangeRequests = changeRequests.map(changeRequest => ({
    id: changeRequest.id,
    connection_id: changeRequest.metadata_database_connection_id,
    database_name: changeRequest.metadata_database_raw_name,
    created_by: changeRequest.created_by,
    title: changeRequest.title,
    description: changeRequest.description ?? null,
    change_request_number: changeRequest.change_request_number,
    status: changeRequest.status,
    labels: labelsByChangeRequestId[changeRequest.id] ?? [],
    reviewers: reviewersByChangeRequestId[changeRequest.id] ?? [],
    related_issues: relatedIssuesByChangeRequestId[changeRequest.id] ?? [],
    created_at: changeRequest.created_at,
    updated_at: changeRequest.updated_at
  }))

  return hydratedChangeRequests
}
