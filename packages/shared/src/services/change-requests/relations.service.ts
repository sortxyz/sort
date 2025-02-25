import { getDb } from '../..'

import type {
  RelationsByChangeRequestId,
  RelationsByIssueId
} from '../../schemas/relations.schema'
import type { SortDB } from '../../types/kysely.type'
import type { Kysely } from 'kysely'

export const createRelation = async (
  changeRequestId: string,
  issueId: string,
  trx?: Kysely<SortDB>
) =>
  await (trx ?? getDb())
    .insertInto('change_request_issue')
    .values({
      change_request_id: changeRequestId,
      issue_id: issueId
    })
    .returningAll()
    .execute()

export const deleteRelation = async (
  changeRequestId: string,
  issueId: string,
  trx?: Kysely<SortDB>
) =>
  await (trx ?? getDb())
    .deleteFrom('change_request_issue')
    .where('issue_id', '=', issueId)
    .where('change_request_id', '=', changeRequestId)
    .execute()

export const getRelations = async ({
  changeRequestId,
  issueId,
  trx
}:
  | { changeRequestId: string; issueId?: never; trx?: Kysely<SortDB> }
  | { changeRequestId?: never; issueId: string; trx?: Kysely<SortDB> }) => {
  let query = (trx ?? getDb())
    .selectFrom('change_request_issue')
    .innerJoin('issue', 'change_request_issue.issue_id', 'issue.id')
    .innerJoin(
      'change_request',
      'change_request_issue.change_request_id',
      'change_request.id'
    )

  if (changeRequestId) {
    query = query.where(
      'change_request_issue.change_request_id',
      '=',
      changeRequestId
    )
  }

  if (issueId) {
    query = query.where('change_request_issue.issue_id', '=', issueId)
  }

  return query
    .select([
      'change_request.title as change_request_title',
      'issue.title as issue_title',
      'change_request.change_request_number',
      'issue.issue_number',
      'issue.id as issue_id',
      'change_request.id as change_request_id'
    ])
    .execute()
}

export const getIssueRelationsByChangeRequestIds = async (
  changeRequestIds: string[],
  trx?: Kysely<SortDB>
) => {
  const query = await (trx ?? getDb())
    .selectFrom('change_request_issue')
    .innerJoin('issue', 'change_request_issue.issue_id', 'issue.id')
    .innerJoin(
      'change_request',
      'change_request_issue.change_request_id',
      'change_request.id'
    )
    .where('change_request_issue.change_request_id', 'in', changeRequestIds)
    .select([
      'issue.title as issue_title',
      'issue.issue_number',
      'issue.id as issue_id',
      'change_request.id as change_request_id'
    ])
    .execute()

  return changeRequestIds.reduce<RelationsByChangeRequestId>((acc, id) => {
    acc[id] =
      query
        .filter(row => row.change_request_id === id)
        .map(row => ({
          issue_number: row.issue_number,
          issue_title: row.issue_title,
          issue_id: row.issue_id
        })) ?? []
    return acc
  }, {})
}

export const getChangeRequestRelationsByIssueIds = async (
  issueIds: string[],
  trx?: Kysely<SortDB>
) => {
  const query = await (trx ?? getDb())
    .selectFrom('change_request_issue')
    .innerJoin('issue', 'change_request_issue.issue_id', 'issue.id')
    .innerJoin(
      'change_request',
      'change_request_issue.change_request_id',
      'change_request.id'
    )
    .where('change_request_issue.issue_id', 'in', issueIds)
    .select([
      'change_request.title as change_request_title',
      'change_request.change_request_number',
      'change_request.id as change_request_id',
      'issue.id as issue_id'
    ])
    .execute()

  return issueIds.reduce<RelationsByIssueId>((acc, id) => {
    acc[id] =
      query
        .filter(row => row.issue_id === id)
        .map(row => ({
          change_request_number: row.change_request_number,
          change_request_title: row.change_request_title,
          change_request_id: row.change_request_id
        })) ?? []
    return acc
  }, {})
}
