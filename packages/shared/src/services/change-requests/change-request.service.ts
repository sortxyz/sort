import { randomUUID } from 'node:crypto'

import { getDb } from '../../'
import { pg7ErrorConditionCodes } from '../../constants/database.constant'
import { JobExistsError } from '../../errors/job-exists.error'
import { NotApprovedError } from '../../errors/not-approved.error'
import { NotFoundError } from '../../errors/not-found.error'
import { unsortedStringArraysEqual, isErrnoException } from '../../utils'
import { createChanges } from '../changes/change-builder.service'
import { getFullChangesResponse } from '../changes/change.service'
import { createJob } from '../changes/job.service'
import { UndoChangesService } from '../changes/undo.service'
import * as LabelService from '../label.service'
import * as OrganizationService from '../org.service'

import {
  createRelation,
  deleteRelation,
  getIssueRelationsByChangeRequestIds,
  getRelations
} from './relations.service'

import type { ChangeRequestComment } from '../../schemas/change-request-comment.schema'
import type {
  ActionDetails,
  ChangeRequestHistory
} from '../../schemas/change-request-history.schema'
import type { FullChangeRequestResponse } from '../../schemas/change-request.schema'
import type { RequestChange } from '../../schemas/change.schema'
import type { Label } from '../../schemas/label.schema'
import type { OrganizationMember } from '../../schemas/org-member.schema'
import type {
  ChangeRequestRelationResponse,
  IssueRelationResponse
} from '../../schemas/relations.schema'
import type { ChangeRequestStatus, SortDB } from '../../types/kysely.type'
import type { Transaction, Kysely } from 'kysely'

export interface ReviewersByChangeRequestId {
  [key: string]: OrganizationMember[]
}

export const getReviewersByChangeRequestIds = async (
  org_slug: string,
  changeRequestIds: string[],
  trx?: Kysely<SortDB>
) => {
  const kyselyDb = trx || getDb()

  if (!changeRequestIds.length) {
    return {}
  }

  const memberRows = await OrganizationService.createGetMembersBaseQueryBuilder(
    org_slug,
    kyselyDb
  )
    .innerJoin(
      'change_request_reviewer',
      'change_request_reviewer.user_id',
      'user.id'
    )
    .where('change_request_reviewer.change_request_id', 'in', changeRequestIds)
    .select('change_request_reviewer.change_request_id')
    .execute()

  return memberRows.reduce<ReviewersByChangeRequestId>((acc, row) => {
    const reviewer = OrganizationService.rowToOrganizationMember(row)

    if (!acc[row.change_request_id]) {
      acc[row.change_request_id] = []
    }

    acc[row.change_request_id].push(reviewer)
    return acc
  }, {})
}

export const getChangeRequestById = async (
  id: string,
  trx?: Transaction<SortDB>
) => {
  const kyselyDb = trx || getDb()

  return await kyselyDb
    .selectFrom('change_request')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirstOrThrow()
}

export const getFullChangeRequestsResponse = async (changeRequestData: {
  org_slug: string
  connection_id: string
  database_name: string
}) => {
  try {
    const changeRequests = await getDb()
      .selectFrom('change_request')
      .selectAll()
      .where(
        'metadata_database_connection_id',
        '=',
        changeRequestData.connection_id
      )
      .where('metadata_database_raw_name', '=', changeRequestData.database_name)
      .orderBy('created_at', 'desc')
      .limit(100)
      .execute()

    if (!changeRequests.length) {
      return []
    }

    const changeRequestIds = changeRequests.map(
      changeRequest => changeRequest.id
    )
    const labelsByChangeRequestId =
      await LabelService.getLabelsByChangeRequestIds(changeRequestIds)
    const reviewersByChangeRequestId = await getReviewersByChangeRequestIds(
      changeRequestData.org_slug,
      changeRequestIds
    )
    const relatedIssuesByChangeRequestId =
      await getIssueRelationsByChangeRequestIds(changeRequestIds)

    return Promise.all(
      changeRequests.map(async changeRequest => {
        return {
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
          related_issues:
            relatedIssuesByChangeRequestId[changeRequest.id] ?? [],
          changes: await getFullChangesResponse(changeRequest.id),
          created_at: changeRequest.created_at,
          updated_at: changeRequest.updated_at
        }
      })
    )
  } catch (error) {
    throw new Error('Failed to get change requests', { cause: error })
  }
}

export const getFullChangeRequestResponse = async (
  changeRequestData: {
    org_slug: string
    connection_id: string
    database_name: string
    change_request_number: number
  },
  trx?: Kysely<SortDB>
) => {
  const kyselyDb = trx || getDb()

  const result = await kyselyDb
    .selectFrom('change_request')
    .selectAll()
    .where(
      'metadata_database_connection_id',
      '=',
      changeRequestData.connection_id
    )
    .where('metadata_database_raw_name', '=', changeRequestData.database_name)
    .where(
      'change_request_number',
      '=',
      changeRequestData.change_request_number
    )
    .executeTakeFirst()

  if (!result) {
    return null
  }

  const labels = await LabelService.getLabelsByChangeRequestIds(
    [result.id],
    trx
  )
  const reviewers = await getReviewersByChangeRequestIds(
    changeRequestData.org_slug,
    [result.id],
    trx
  )
  const rawRelatedIssues = await getRelations({
    changeRequestId: result.id,
    trx
  })
  const relatedIssues = rawRelatedIssues.map(n => ({
    issue_number: n.issue_number,
    issue_title: n.issue_title,
    issue_id: n.issue_id
  }))

  const changes = await getFullChangesResponse(result.id)

  return {
    id: result.id,
    connection_id: result.metadata_database_connection_id,
    database_name: result.metadata_database_raw_name,
    created_by: result.created_by,
    title: result.title,
    description: result.description ?? null,
    change_request_number: result.change_request_number,
    status: result.status,
    labels: labels[result.id] ?? [],
    reviewers: reviewers[result.id] ?? [],
    related_issues: relatedIssues,
    changes: changes,
    created_at: result.created_at,
    updated_at: result.updated_at
  } satisfies FullChangeRequestResponse
}

export const getChangeRequestsByNumbers = async ({
  connectionId,
  databaseName,
  changeRequestNumbers
}: {
  connectionId: string
  databaseName: string
  changeRequestNumbers: number[]
}) => {
  if (!changeRequestNumbers.length) {
    return [] as IssueRelationResponse[]
  }

  return await getDb()
    .selectFrom('change_request')
    .where('metadata_database_connection_id', '=', connectionId)
    .where('metadata_database_raw_name', '=', databaseName)
    .where('change_request_number', 'in', changeRequestNumbers)
    .select('id as change_request_id')
    .select('title as change_request_title')
    .select('change_request_number')
    .execute()
}

export const addChangeRequestHistory = async (
  changeRequestData: {
    history: Omit<ChangeRequestHistory, 'user'>
    userId: string
  },
  trx?: Kysely<SortDB>
) => {
  try {
    return await (trx ?? getDb())
      .insertInto('change_request_history')
      .values({
        change_request_id: changeRequestData.history.change_request_id,
        user_id: changeRequestData.userId,
        action_type: changeRequestData.history.action_type,
        action_details: JSON.stringify(
          changeRequestData.history.action_details
        ),
        created_at: changeRequestData.history.created_at
      })
      .returningAll()
      .$castTo<ChangeRequestHistory>()
      .execute()
  } catch (error) {
    throw new Error('Failed to add change request history', { cause: error })
  }
}

export const createUndoChangeRequest = async (
  changeRequest: FullChangeRequestResponse,
  created_by: string
) => {
  const changeRequestId = randomUUID()

  const undoService = new UndoChangesService(changeRequest.changes)

  return createChangeRequest({
    id: changeRequestId,
    connection_id: changeRequest.connection_id,
    database_name: changeRequest.database_name,
    created_by,
    title: 'Revert "' + changeRequest.title + '"',
    description:
      'Revert changes made in change request ' +
      changeRequest.change_request_number,
    labels: changeRequest.labels,
    reviewers: [],
    changes: await undoService.generateUndoChanges(),
    related_issues: []
  })
}

export const createChangeRequest = async (changeRequestData: {
  id: string
  connection_id: string
  database_name: string
  created_by: string
  title: string
  description?: string | null
  labels: Label[]
  reviewers: OrganizationMember[]
  changes: RequestChange[]
  // eslint-disable-next-line @typescript-eslint/naming-convention
  related_issues: ChangeRequestRelationResponse[]
}) => {
  try {
    return await getDb()
      .transaction()
      .execute(async trx => {
        const now = new Date()

        const newChangeRequest = await trx
          .insertInto('change_request')
          .values({
            id: changeRequestData.id,
            metadata_database_connection_id: changeRequestData.connection_id,
            metadata_database_raw_name: changeRequestData.database_name,
            created_by: changeRequestData.created_by,
            title: changeRequestData.title,
            description: changeRequestData.description || null,
            status: 'open',
            updated_at: now,
            created_at: now
          })
          .returning([
            'id',
            'metadata_database_connection_id as connection_id',
            'metadata_database_raw_name as database_name',
            'created_by',
            'title',
            'description',
            'change_request_number',
            'status',
            'created_at',
            'updated_at'
          ])
          .executeTakeFirstOrThrow()

        await trx
          .insertInto('change_request_history')
          .values({
            change_request_id: newChangeRequest.id,
            user_id: changeRequestData.created_by,
            action_type: 'CREATE_CHANGE_REQUEST',
            action_details: JSON.stringify({
              change_request_number: newChangeRequest.change_request_number
            }),
            created_at: now
          })
          .execute()

        // Handle labels
        if (changeRequestData.labels.length) {
          const changeRequestLabels = changeRequestData.labels.map(label => ({
            change_request_id: newChangeRequest.id,
            label_id: label.id
          }))

          await trx
            .insertInto('change_request_label')
            .values(changeRequestLabels)
            .execute()

          await trx
            .insertInto('change_request_history')
            .values(
              changeRequestData.labels.map(label => ({
                change_request_id: newChangeRequest.id,
                user_id: changeRequestData.created_by,
                action_type: 'ADD_LABEL',
                action_details: JSON.stringify({ label }),
                created_at: now
              }))
            )
            .execute()
        }

        // Handle reviewers
        if (changeRequestData.reviewers.length) {
          const changeRequestReviewers = changeRequestData.reviewers.map(
            reviewer => ({
              change_request_id: newChangeRequest.id,
              user_id: reviewer.user.id
            })
          )

          await trx
            .insertInto('change_request_reviewer')
            .values(changeRequestReviewers)
            .execute()

          await trx
            .insertInto('change_request_history')
            .values(
              changeRequestData.reviewers.map(reviewer => ({
                change_request_id: newChangeRequest.id,
                user_id: changeRequestData.created_by,
                action_type: 'ADD_REVIEWER',
                action_details: JSON.stringify({ reviewer }),
                created_at: now
              }))
            )
            .execute()
        }

        // Handles related issues creation
        if (changeRequestData.related_issues.length) {
          for (const issue of changeRequestData.related_issues) {
            await createRelation(newChangeRequest.id, issue.issue_id, trx)
          }
        }

        // Handle changes creation
        const createdChanges = changeRequestData.changes?.length
          ? await createChanges(
              trx,
              newChangeRequest.id,
              changeRequestData.connection_id,
              changeRequestData.database_name,
              changeRequestData.changes
            )
          : []

        return {
          ...newChangeRequest,
          labels: changeRequestData.labels,
          reviewers: changeRequestData.reviewers,
          changes: createdChanges,
          related_issues: changeRequestData.related_issues
        } satisfies FullChangeRequestResponse
      })
  } catch (error) {
    throw new Error('Failed to create change request', { cause: error })
  }
}

export const getChangeRequestId = async (
  db: Kysely<SortDB>,
  changeRequestData: {
    connectionId: string
    databaseRawName: string
    changeRequestNumber: number
  }
) => {
  const changeRequest = await db
    .selectFrom('change_request')
    .where(
      'metadata_database_connection_id',
      '=',
      changeRequestData.connectionId
    )
    .where('metadata_database_raw_name', '=', changeRequestData.databaseRawName)
    .where('change_request_number', '=', changeRequestData.changeRequestNumber)
    .select('id')
    .executeTakeFirst()

  if (!changeRequest) {
    throw new NotFoundError('change request')
  }

  return changeRequest.id
}

/**
 * Creates the change request execution job and updates the change request
 * status to executing.
 */
export const executeChangeRequest = async (changeRequestData: {
  connectionId: string
  databaseRawName: string
  changeRequestNumber: number
  userId: string
}) => {
  return await getDb()
    .transaction()
    .execute(async trx => {
      const changeRequestId = await getChangeRequestId(trx, changeRequestData)
      const changeRequestStatus = await trx
        .selectFrom('change_request')
        .where('id', '=', changeRequestId)
        .select('status')
        .executeTakeFirstOrThrow()

      if (changeRequestStatus.status === 'executing') {
        throw new JobExistsError(changeRequestId)
      }

      if (changeRequestStatus.status !== 'approved') {
        throw new NotApprovedError()
      }

      const changeRequest = await trx
        .updateTable('change_request')
        .where('id', '=', changeRequestId)
        .where('status', '=', 'approved')
        .set({
          status: 'executing',
          updated_at: new Date()
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      const job = await createJob(trx, changeRequestId)

      await trx
        .insertInto('change_request_history')
        .values({
          change_request_id: changeRequestId,
          user_id: changeRequestData.userId,
          action_type: 'START_EXECUTE',
          action_details: JSON.stringify({
            change_request_job_id: job.id
          }),
          created_at: job.created_at
        })
        .execute()

      return {
        changeRequest,
        job
      }
    })
}

interface LabelsDiff {
  add: Label[]
  remove: Label[]
}

interface RelatedIssuesDiff {
  add: ChangeRequestRelationResponse[]
  remove: ChangeRequestRelationResponse[]
}

interface ReviewersDiff {
  add: OrganizationMember[]
  remove: OrganizationMember[]
}

type HistoryContext = {
  trx: Transaction<SortDB>
  changeRequestId: string
  userId: string
  currentDate: Date
}

export const addHistoryItem = async (
  ctx: HistoryContext,
  actionType: string,
  actionDetails: ActionDetails
) =>
  await ctx.trx
    .insertInto('change_request_history')
    .values({
      change_request_id: ctx.changeRequestId,
      user_id: ctx.userId,
      action_type: actionType,
      action_details: JSON.stringify(actionDetails),
      created_at: ctx.currentDate
    })
    .execute()

const addHistoryItems = async (
  ctx: HistoryContext,
  actionType: string,
  actionDetails: ActionDetails[]
) =>
  await ctx.trx
    .insertInto('change_request_history')
    .values(
      actionDetails.map(action => ({
        change_request_id: ctx.changeRequestId,
        user_id: ctx.userId,
        action_type: actionType,
        action_details: JSON.stringify(action),
        created_at: ctx.currentDate
      }))
    )
    .execute()

export const updateChangeRequestStatus = async (
  db: Kysely<SortDB>,
  changeRequestId: string,
  status: ChangeRequestStatus,
  updatedAt: Date = new Date()
) => {
  return await db
    .updateTable('change_request')
    .set({
      status,
      updated_at: updatedAt
    })
    .where('id', '=', changeRequestId)
    .executeTakeFirstOrThrow()
}

export const updateChangeRequest = async (
  where: {
    user_id: string
    changeRequestData: {
      org_slug: string
      connection_id: string
      database_name: string
      change_request_number: number
    }
  },
  updateData: {
    title?: string
    description?: string | null
    status?: ChangeRequestStatus
    labels?: Label[]
    reviewers?: OrganizationMember[]
    relatedIssues?: ChangeRequestRelationResponse[]
  }
) => {
  const existingChangeRequest = await getFullChangeRequestResponse({
    org_slug: where.changeRequestData.org_slug,
    connection_id: where.changeRequestData.connection_id,
    database_name: where.changeRequestData.database_name,
    change_request_number: where.changeRequestData.change_request_number
  })
  if (existingChangeRequest === null) {
    throw new Error('Invalid change request criterion passed')
  }

  const { title, description, status, labels, reviewers, relatedIssues } =
    updateData
  const updates: Partial<FullChangeRequestResponse> = {}

  const labelsDiff: LabelsDiff = { add: [], remove: [] }
  const reviewersDiff: ReviewersDiff = { add: [], remove: [] }
  const relatedIssuesDiff: RelatedIssuesDiff = { add: [], remove: [] }

  const existingLabelIds = existingChangeRequest.labels.map(label => label.id)
  const existingReviewerIds = existingChangeRequest.reviewers.map(
    reviewer => reviewer.user.id
  )
  const existingRelatedIssueIds = existingChangeRequest.related_issues.map(
    n => n.issue_id
  )

  const newLabelIds = labels ? labels.map(label => label.id) : []
  const newReviewerIds = reviewers
    ? reviewers.map(reviewer => reviewer.user.id)
    : []
  const newRelatedIssueIds = relatedIssues
    ? relatedIssues.map(issue => issue.issue_id)
    : []

  if (title && title !== existingChangeRequest.title) {
    updates.title = title
  }

  if (description && description !== existingChangeRequest.description) {
    updates.description = description
  }

  if (status && status !== existingChangeRequest.status) {
    updates.status = status
  }

  if (labels && !unsortedStringArraysEqual(newLabelIds, existingLabelIds)) {
    const newLabelIds = labels.map(label => label.id)
    const existingLabelIds = existingChangeRequest.labels.map(label => label.id)

    labelsDiff.add = labels.filter(
      label => !existingLabelIds.includes(label.id)
    )

    labelsDiff.remove = existingChangeRequest.labels.filter(
      label => !newLabelIds.includes(label.id)
    )
  }

  if (
    reviewers &&
    !unsortedStringArraysEqual(newReviewerIds, existingReviewerIds)
  ) {
    const newReviewerIds = reviewers.map(reviewer => reviewer.user.id)
    const existingReviewerIds = existingChangeRequest.reviewers.map(
      reviewer => reviewer.user.id
    )

    reviewersDiff.add = reviewers.filter(
      reviewer => !existingReviewerIds.includes(reviewer.user.id)
    )

    reviewersDiff.remove = existingChangeRequest.reviewers.filter(
      reviewer => !newReviewerIds.includes(reviewer.user.id)
    )
  }

  if (
    relatedIssues &&
    !unsortedStringArraysEqual(newRelatedIssueIds, existingRelatedIssueIds)
  ) {
    relatedIssuesDiff.add = relatedIssues.filter(
      issue => !existingRelatedIssueIds.includes(issue.issue_id)
    )

    relatedIssuesDiff.remove = existingChangeRequest.related_issues.filter(
      issue => !newRelatedIssueIds.includes(issue.issue_id)
    )
  }

  // if there are no updates, return the existing change request
  if (
    !Object.keys(updates).length &&
    !labelsDiff.add.length &&
    !labelsDiff.remove.length &&
    !reviewersDiff.add.length &&
    !reviewersDiff.remove.length &&
    !relatedIssuesDiff.add.length &&
    !relatedIssuesDiff.remove.length
  ) {
    return existingChangeRequest
  }

  const now = new Date()
  updates.updated_at = now

  try {
    return await getDb()
      .transaction()
      .execute(async trx => {
        let updatedChangeRequest: FullChangeRequestResponse

        if (Object.keys(updates).length > 0) {
          const rawUpdatedChangeRequest = await trx
            .updateTable('change_request')
            .set(updates)
            .where('id', '=', existingChangeRequest.id)
            .returningAll()
            .executeTakeFirstOrThrow()

          updatedChangeRequest = {
            ...rawUpdatedChangeRequest,
            connection_id:
              rawUpdatedChangeRequest.metadata_database_connection_id,
            database_name: rawUpdatedChangeRequest.metadata_database_raw_name,
            labels: [],
            reviewers: [],
            changes: [],
            related_issues: []
          }
        } else {
          updatedChangeRequest = existingChangeRequest
        }

        const ctx = {
          trx,
          changeRequestId: updatedChangeRequest.id,
          userId: where.user_id,
          currentDate: now
        } satisfies HistoryContext

        if (title && title !== existingChangeRequest.title) {
          await addHistoryItem(ctx, 'UPDATE_TITLE', {
            prev: existingChangeRequest.title,
            curr: title
          })
        }

        if (description && description !== existingChangeRequest.description) {
          await addHistoryItem(ctx, 'UPDATE_DESCRIPTION', {
            prev: existingChangeRequest.description,
            curr: description
          })
        }

        if (status === 'closed' && existingChangeRequest.status !== 'closed') {
          await addHistoryItem(ctx, 'CLOSE_CHANGE_REQUEST', {
            change_request_number: updatedChangeRequest.change_request_number
          })
        } else if (
          status === 'open' &&
          existingChangeRequest.status === 'closed'
        ) {
          await addHistoryItem(ctx, 'REOPEN_CHANGE_REQUEST', {
            change_request_number: updatedChangeRequest.change_request_number
          })
        }

        if (labelsDiff.add.length) {
          await trx
            .insertInto('change_request_label')
            .values(
              labelsDiff.add.map(label => ({
                change_request_id: updatedChangeRequest.id,
                label_id: label.id
              }))
            )
            .execute()

          await addHistoryItems(
            ctx,
            'ADD_LABEL',
            labelsDiff.add.map(label => ({ label }))
          )
        }

        if (labelsDiff.remove.length) {
          await trx
            .deleteFrom('change_request_label')
            .where('change_request_id', '=', existingChangeRequest.id)
            .where(
              'label_id',
              'in',
              labelsDiff.remove.map(label => label.id)
            )
            .execute()

          await addHistoryItems(
            ctx,
            'REMOVE_LABEL',
            labelsDiff.remove.map(label => ({ label }))
          )
        }

        if (reviewersDiff.add.length) {
          await trx
            .insertInto('change_request_reviewer')
            .values(
              reviewersDiff.add.map(reviewer => ({
                change_request_id: updatedChangeRequest.id,
                user_id: reviewer.user.id
              }))
            )
            .execute()

          await addHistoryItems(
            ctx,
            'ADD_REVIEWER',
            reviewersDiff.add.map(reviewer => ({ reviewer }))
          )
        }

        if (reviewersDiff.remove.length) {
          await trx
            .deleteFrom('change_request_reviewer')
            .where('change_request_id', '=', existingChangeRequest.id)
            .where(
              'user_id',
              'in',
              reviewersDiff.remove.map(reviewer => reviewer.user.id)
            )
            .execute()

          await addHistoryItems(
            ctx,
            'REMOVE_REVIEWER',
            reviewersDiff.remove.map(reviewer => ({ reviewer }))
          )
        }

        if (relatedIssuesDiff.add.length) {
          for (const issue of relatedIssuesDiff.add) {
            await createRelation(updatedChangeRequest.id, issue.issue_id, trx)
          }
        }

        if (relatedIssuesDiff.remove.length) {
          for (const issue of relatedIssuesDiff.remove) {
            await deleteRelation(updatedChangeRequest.id, issue.issue_id, trx)
          }
        }

        const getUpdatedChangeRequest = await getFullChangeRequestResponse(
          {
            org_slug: where.changeRequestData.org_slug,
            connection_id: where.changeRequestData.connection_id,
            database_name: where.changeRequestData.database_name,
            change_request_number: where.changeRequestData.change_request_number
          },
          trx
        )

        return getUpdatedChangeRequest!
      })
  } catch (error) {
    throw new Error('Failed to update change request', { cause: error })
  }
}

export const getChangeRequestComment = async (id: string) => {
  try {
    return await getDb()
      .selectFrom('change_request_comment')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()
  } catch (error) {
    throw new Error('Failed to get change request comment', { cause: error })
  }
}

type AtLeastOneRequired<T> = {
  [K in keyof T]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<keyof T, K>>>
}[keyof T]

export const getChangeRequestComments = async (
  where: AtLeastOneRequired<
    Pick<ChangeRequestComment, 'change_request_id' | 'change_id' | 'review_id'>
  >
) => {
  try {
    let commentsQuery = getDb()
      .selectFrom('change_request_comment')
      .selectAll()
      .orderBy('created_at', 'asc')

    if (where.change_request_id) {
      commentsQuery = commentsQuery.where(
        'change_request_id',
        '=',
        where.change_request_id
      )
    }

    if (where.change_id) {
      commentsQuery = commentsQuery.where('change_id', '=', where.change_id)
    }

    if (where.review_id) {
      commentsQuery = commentsQuery.where('review_id', '=', where.review_id)
    }

    return await commentsQuery.execute()
  } catch (error) {
    throw new Error('Failed to get change request comments', { cause: error })
  }
}

export const createChangeRequestComment = async (
  where: {
    org_slug: string
    change_request_id: string
    change_id?: string
    review_id?: string
  },
  changeRequestCommentData: {
    id: string
    created_by: string
    content: string
  }
) => {
  try {
    return await getDb()
      .transaction()
      .execute(async trx => {
        const now = new Date()

        const newComment = await trx
          .insertInto('change_request_comment')
          .values({
            id: changeRequestCommentData.id,
            change_request_id: where.change_request_id,
            created_by: changeRequestCommentData.created_by,
            content: changeRequestCommentData.content,
            change_id: where.change_id ?? null,
            review_id: where.review_id ?? null,
            created_at: now,
            updated_at: now
          })
          .returningAll()
          .executeTakeFirstOrThrow()

        await trx
          .insertInto('change_request_history')
          .values({
            change_request_id: newComment.change_request_id,
            user_id: changeRequestCommentData.created_by,
            action_type: 'ADD_COMMENT',
            action_details: JSON.stringify({
              comment_id: newComment.id,
              change_id: newComment.change_id,
              review_id: newComment.review_id,
              content: newComment.content
            }),
            created_at: now
          })
          .execute()

        return newComment
      })
  } catch (error) {
    if (
      isErrnoException(error) &&
      error.code &&
      error.code === pg7ErrorConditionCodes.FOREIGN_KEY_VIOLATION
    ) {
      const errorWithConstraint = error as Error & { constraint: string }

      let entity
      switch (errorWithConstraint.constraint) {
        case 'fk_change_request_comment_change_id':
          entity = 'Change'
          break
        case 'fk_change_request_comment_review_id':
          entity = 'Review'
          break
        default:
          entity = 'Change Request'
      }

      throw new Error(`${entity} does not exist`, {
        cause: error
      })
    }
    throw new Error('Failed to create change request comment', { cause: error })
  }
}

export const updateChangeRequestComment = async (changeRequestCommentData: {
  id: string
  change_request_id: string
  content: string
}) => {
  try {
    return await getDb()
      .transaction()
      .execute(async trx => {
        const now = new Date()

        const originalComment = await trx
          .selectFrom('change_request_comment')
          .select(['id', 'content'])
          .where('id', '=', changeRequestCommentData.id)
          .executeTakeFirstOrThrow()

        const updatedComment = await trx
          .updateTable('change_request_comment')
          .set({
            content: changeRequestCommentData.content,
            updated_at: now
          })
          .where('id', '=', changeRequestCommentData.id)
          .returningAll()
          .executeTakeFirstOrThrow()

        await trx
          .insertInto('change_request_history')
          .values({
            change_request_id: changeRequestCommentData.change_request_id,
            user_id: updatedComment.created_by,
            action_type: 'UPDATE_COMMENT',
            action_details: JSON.stringify({
              comment_id: originalComment.id,
              change_id: updatedComment.change_id,
              review_id: updatedComment.review_id,
              content: updatedComment.content
            }),
            created_at: now
          })
          .execute()

        return updatedComment
      })
  } catch (error) {
    throw new Error('Failed to update change request comment', { cause: error })
  }
}

export const deleteChangeRequestComment = async (changeRequestCommentData: {
  id: string
  userId: string
  change_request_id: string
}) => {
  try {
    if (!changeRequestCommentData.id.trim()) {
      throw new Error('Invalid change request comment id provided')
    }

    return await getDb()
      .transaction()
      .execute(async trx => {
        const deletedComment = await trx
          .deleteFrom('change_request_comment')
          .where('id', '=', changeRequestCommentData.id)
          .returningAll()
          .executeTakeFirstOrThrow()

        await trx
          .insertInto('change_request_history')
          .values({
            change_request_id: changeRequestCommentData.change_request_id,
            user_id: changeRequestCommentData.userId,
            action_type: 'REMOVE_COMMENT',
            action_details: JSON.stringify({
              comment_id: deletedComment.id,
              change_id: deletedComment.change_id,
              review_id: deletedComment.review_id,
              content: deletedComment.content
            }),
            created_at: new Date()
          })
          .execute()

        return deletedComment
      })
  } catch (error) {
    throw new Error('Failed to delete change request comment', { cause: error })
  }
}
