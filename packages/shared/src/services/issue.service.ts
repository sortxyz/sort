import { getDb } from '../'
import { pg7ErrorConditionCodes } from '../constants/database.constant'
import { unsortedStringArraysEqual, isErrnoException } from '../utils'

import {
  createRelation,
  deleteRelation,
  getChangeRequestRelationsByIssueIds
} from './change-requests/relations.service'
import { getIssueCommentPermissions } from './issue.permissions.service'
import * as LabelService from './label.service'
import * as OrganizationService from './org.service'

import type {
  IssueHistory,
  IssueHistoryRemoveComment,
  ActionDetails
} from '../schemas/issue-history.schema'
import type { AssigneesByIssueId, Issue } from '../schemas/issue.schema'
import type { Label } from '../schemas/label.schema'
import type { OrganizationMember } from '../schemas/org-member.schema'
import type { Organization } from '../schemas/org.schema'
import type {
  ChangeRequestRelationResponse,
  IssueRelationResponse
} from '../schemas/relations.schema'
import type { SortDB } from '../types/kysely.type'
import type { SortContext } from '../types/sort-context.type'
import type { Transaction, Kysely } from 'kysely'

export const getAssigneesByIssueIds = async (
  org_slug: string,
  issueIds: string[],
  trx?: Kysely<SortDB>
) => {
  const kyselyDb = trx || getDb()

  if (!issueIds.length) {
    return {}
  }

  const memberRows = await OrganizationService.createGetMembersBaseQueryBuilder(
    org_slug,
    kyselyDb
  )
    .innerJoin('issue_assignee', 'issue_assignee.user_id', 'user.id')
    .where('issue_assignee.issue_id', 'in', issueIds)
    .select('issue_assignee.issue_id')
    .execute()

  return memberRows.reduce<AssigneesByIssueId>((acc, row) => {
    const assignee = OrganizationService.rowToOrganizationMember(row)

    if (!acc[row.issue_id]) {
      acc[row.issue_id] = []
    }

    acc[row.issue_id].push(assignee)
    return acc
  }, {})
}

export const getIssueById = async (id: string) =>
  await getDb()
    .selectFrom('issue')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirstOrThrow()

export const getIssuesByNumbers = async ({
  connection_id,
  database_name,
  issueNumbers
}: {
  connection_id: string
  database_name: string
  issueNumbers: number[]
}) => {
  if (!issueNumbers.length) {
    return [] as ChangeRequestRelationResponse[]
  }

  return await getDb()
    .selectFrom('issue')
    .selectAll()
    .where('metadata_database_connection_id', '=', connection_id)
    .where('metadata_database_raw_name', '=', database_name)
    .where('issue_number', 'in', issueNumbers)
    .select('id as issue_id')
    .select('title as issue_title')
    .select('issue_number')
    .execute()
}

export const getDatabaseIssues = async (issueData: {
  org_slug: string
  connection_id: string
  database_name: string
}) => {
  try {
    const issues = await getDb()
      .selectFrom('issue')
      .selectAll()
      .where('metadata_database_connection_id', '=', issueData.connection_id)
      .where('metadata_database_raw_name', '=', issueData.database_name)
      .orderBy('created_at', 'desc')
      .limit(100)
      .execute()

    if (!issues.length) {
      return []
    }

    const issueIds = issues.map(issue => issue.id)
    const labelsByIssueId = await LabelService.getLabelsByIssueIds(issueIds)
    const assigneesByIssueId = await getAssigneesByIssueIds(
      issueData.org_slug,
      issueIds
    )
    const relatedChangeRequestsByIssueId =
      await getChangeRequestRelationsByIssueIds(issueIds)

    return issues.map(issue => ({
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
  } catch (error) {
    throw new Error('Failed to get issues', { cause: error })
  }
}

export const getIssue = async (
  issueData: {
    org_slug: string
    connection_id: string
    database_name: string
    issue_number: number
  },
  trx?: Kysely<SortDB>
) => {
  const kyselyDb = trx || getDb()

  const result = await kyselyDb
    .selectFrom('issue')
    .selectAll()
    .where('metadata_database_connection_id', '=', issueData.connection_id)
    .where('metadata_database_raw_name', '=', issueData.database_name)
    .where('issue_number', '=', issueData.issue_number)
    .executeTakeFirst()

  if (!result) {
    return null
  }

  const labels = await LabelService.getLabelsByIssueIds([result.id], trx)
  const assignees = await getAssigneesByIssueIds(
    issueData.org_slug,
    [result.id],
    trx
  )
  const relatedChangeRequests = await getChangeRequestRelationsByIssueIds(
    [result.id],
    trx
  )

  return {
    id: result.id,
    connection_id: result.metadata_database_connection_id,
    database_name: result.metadata_database_raw_name,
    created_by: result.created_by,
    title: result.title,
    description: result.description ?? null,
    issue_number: result.issue_number,
    status: result.status,
    labels: labels[result.id] ?? [],
    assignees: assignees[result.id] ?? [],
    related_change_requests: relatedChangeRequests[result.id] ?? [],
    created_at: result.created_at,
    updated_at: result.updated_at
  }
}

export const getIssueHistory = async (issue_id: string) => {
  try {
    return await getDb()
      .selectFrom('issue_history')
      .selectAll()
      .where('issue_id', '=', issue_id)
      .orderBy('created_at', 'asc')
      .$castTo<IssueHistory>()
      .execute()
  } catch (error) {
    throw new Error('Failed to get issue history', { cause: error })
  }
}

export const getIssueTimeline = async (issue_id: string) => {
  const relevantActionTypes = [
    'CREATE_ISSUE',
    'CLOSE_ISSUE',
    'REOPEN_ISSUE',
    'UPDATE_TITLE',
    'ADD_LABEL',
    'REMOVE_LABEL',
    'ADD_ASSIGNEE',
    'REMOVE_ASSIGNEE',
    'ADD_COMMENT',
    'UPDATE_COMMENT',
    'REMOVE_COMMENT',
    'UPDATE_DESCRIPTION'
  ] satisfies IssueHistory['action_type'][]

  try {
    const timelineRows = await getDb()
      .selectFrom('issue_history')
      .innerJoin('user', 'user.id', 'issue_history.user_id')
      .select([
        'issue_history.id',
        'issue_history.issue_id',
        'issue_history.action_type',
        'issue_history.action_details',
        'issue_history.created_at',
        'user.id as user_id',
        'user.name as user_name',
        'user.username as user_username',
        'user.picture as user_picture'
      ])
      .where('issue_id', '=', issue_id)
      .where('action_type', 'in', relevantActionTypes)
      .orderBy('created_at', 'desc')
      .execute()

    const timeline = timelineRows.map(row => ({
      id: row.id,
      issue_id: row.issue_id,
      user: {
        id: row.user_id,
        name: row.user_name,
        username: row.user_username,
        picture: row.user_picture
      },
      action_type: row.action_type,
      action_details: row.action_details,
      created_at: row.created_at
    })) as IssueHistory[]

    // 1. Get the comment IDs for all deleted comments
    const removedCommentIds = new Set(
      timeline
        .filter(
          (event): event is IssueHistoryRemoveComment =>
            event.action_type === 'REMOVE_COMMENT'
        )
        .map(event => event.action_details.comment_id)
    )

    // 2. Keep the most recent event for each comment that hasn't been deleted
    const addCommentEvents: Record<string, IssueHistory> = {}
    const commentEvents: Record<string, IssueHistory> = {}
    timeline.forEach(event => {
      switch (event.action_type) {
        case 'ADD_COMMENT':
        case 'UPDATE_COMMENT': {
          const commentId = event.action_details.comment_id
          if (event.action_type === 'ADD_COMMENT') {
            addCommentEvents[commentId] = event
          }
          if (!commentEvents[commentId] && !removedCommentIds.has(commentId)) {
            commentEvents[commentId] = event
          }
          break
        }
        case 'REMOVE_COMMENT': {
          const commentId = event.action_details.comment_id
          removedCommentIds.add(commentId)
          delete commentEvents[commentId]
          break
        }
      }
    })

    // 4. Filter the timeline to only include the most recent event for each existing comment
    let filteredTimeline = timeline.filter(event => {
      switch (event.action_type) {
        case 'ADD_COMMENT':
        case 'UPDATE_COMMENT': {
          const commentEvent = commentEvents[event.action_details.comment_id]
          return commentEvent && commentEvent.id === event.id
        }
        case 'REMOVE_COMMENT':
          // Exclude the event if the comment ID has been removed.
          return !removedCommentIds.has(event.action_details.comment_id)
        default:
          // Keep all other events.
          return true
      }
    })

    // 4.5. Update each comment in the timeline created_at to the most recent event
    filteredTimeline = filteredTimeline.map(event => {
      if (event.action_type === 'UPDATE_COMMENT') {
        event.created_at =
          addCommentEvents[event.action_details.comment_id].created_at
      }
      return event
    })

    // 4.75. Sort the timeline again
    const sortedTimeline = filteredTimeline.sort(
      (a, b) => b.created_at.getTime() - a.created_at.getTime()
    )

    // 5. Infill each label with the updated label attributes
    const labelEvents = sortedTimeline.filter(
      event =>
        event.action_type === 'ADD_LABEL' ||
        event.action_type === 'REMOVE_LABEL'
    )
    for (const event of labelEvents) {
      const label = event.action_details
      const newerLabels = await LabelService.getLabel(label.label.id)
      if (newerLabels) {
        label.label = newerLabels
      }
    }

    // 6. Create event may happen at same time as add label/assignee, ensure it's at the end
    const createEventIndex = sortedTimeline.findLastIndex(
      event => event.action_type === 'CREATE_ISSUE'
    )
    if (createEventIndex !== sortedTimeline.length - 1) {
      const [createEvent] = sortedTimeline.splice(createEventIndex, 1)
      sortedTimeline.push(createEvent)
    }

    return sortedTimeline.reverse()
  } catch (error) {
    throw new Error('Failed to get issue history', { cause: error })
  }
}

export const attachCommentPermissions = async (
  timeline: IssueHistory[],
  issue: Issue,
  org: Organization,
  ctx: SortContext
) => {
  for (const event of timeline) {
    if (
      event.action_type === 'ADD_COMMENT' ||
      event.action_type === 'UPDATE_COMMENT'
    ) {
      event.permissions = await getIssueCommentPermissions(
        issue,
        event.user.id,
        org,
        ctx
      )
    }
  }

  return timeline
}

export const createIssue = async (issueData: {
  id: string
  connection_id: string
  database_name: string
  created_by: string
  title: string
  description?: string | null
  labels?: Label[]
  assignees?: OrganizationMember[]
  related_change_requests?: IssueRelationResponse[]
}) => {
  try {
    return await getDb()
      .transaction()
      .execute(async trx => {
        const now = new Date()

        const newIssue = await trx
          .insertInto('issue')
          .values({
            id: issueData.id,
            metadata_database_connection_id: issueData.connection_id,
            metadata_database_raw_name: issueData.database_name,
            created_by: issueData.created_by,
            title: issueData.title,
            description: issueData.description || null,
            status: 'open',
            created_at: now,
            updated_at: now
          })
          .returningAll()
          .executeTakeFirstOrThrow()

        await trx
          .insertInto('issue_history')
          .values({
            issue_id: newIssue.id,
            user_id: issueData.created_by,
            action_type: 'CREATE_ISSUE',
            action_details: JSON.stringify({
              issue_number: newIssue.issue_number
            }),
            created_at: now
          })
          .execute()

        // Handle labels
        if (issueData.labels?.length) {
          const issueLabels = issueData.labels.map(label => ({
            issue_id: newIssue.id,
            label_id: label.id
          }))

          await trx.insertInto('issue_label').values(issueLabels).execute()

          await trx
            .insertInto('issue_history')
            .values(
              issueData.labels.map(label => ({
                issue_id: newIssue.id,
                user_id: issueData.created_by,
                action_type: 'ADD_LABEL',
                action_details: JSON.stringify({ label }),
                created_at: now
              }))
            )
            .execute()
        }

        // Handle assignees
        if (issueData.assignees?.length) {
          const issueAssignees = issueData.assignees.map(assignee => ({
            issue_id: newIssue.id,
            user_id: assignee.user.id
          }))

          await trx
            .insertInto('issue_assignee')
            .values(issueAssignees)
            .execute()

          await trx
            .insertInto('issue_history')
            .values(
              issueData.assignees.map(assignee => ({
                issue_id: newIssue.id,
                user_id: issueData.created_by,
                action_type: 'ADD_ASSIGNEE',
                action_details: JSON.stringify({ assignee }),
                created_at: now
              }))
            )
            .execute()
        }

        // Handle related change requests
        if (issueData.related_change_requests?.length) {
          for (const changeRequest of issueData.related_change_requests) {
            await createRelation(
              changeRequest.change_request_id,
              newIssue.id,
              trx
            )
          }
        }

        return {
          ...newIssue,
          connection_id: newIssue.metadata_database_connection_id,
          database_name: newIssue.metadata_database_raw_name,
          labels: issueData.labels ?? [],
          assignees: issueData.assignees ?? [],
          related_change_requests: issueData.related_change_requests ?? []
        } satisfies Issue
      })
  } catch (error) {
    throw new Error('Failed to create issue', { cause: error })
  }
}

interface LabelsDiff {
  add: Label[]
  remove: Label[]
}

interface AssigneesDiff {
  add: OrganizationMember[]
  remove: OrganizationMember[]
}

interface RelatedChangeRequestsDiff {
  add: IssueRelationResponse[]
  remove: IssueRelationResponse[]
}

type HistoryContext = {
  trx: Transaction<SortDB>
  issueId: string
  userId: string
  currentDate: Date
}

const addHistoryItem = async (
  ctx: HistoryContext,
  actionType: string,
  actionDetails: ActionDetails
) =>
  await ctx.trx
    .insertInto('issue_history')
    .values({
      issue_id: ctx.issueId,
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
    .insertInto('issue_history')
    .values(
      actionDetails.map(action => ({
        issue_id: ctx.issueId,
        user_id: ctx.userId,
        action_type: actionType,
        action_details: JSON.stringify(action),
        created_at: ctx.currentDate
      }))
    )
    .execute()

export const updateIssue = async (
  where: {
    user_id: string
    issueData: {
      org_slug: string
      connection_id: string
      database_name: string
      issue_number: number
    }
  },
  updateData: {
    title?: string
    description?: string | null
    status?: 'open' | 'closed'
    labels?: Label[]
    assignees?: OrganizationMember[]
    relatedChangeRequests?: IssueRelationResponse[]
  }
) => {
  const existingIssue = await getIssue({
    org_slug: where.issueData.org_slug,
    connection_id: where.issueData.connection_id,
    database_name: where.issueData.database_name,
    issue_number: where.issueData.issue_number
  })

  if (existingIssue === null) {
    throw new Error('Invalid issue criterion passed')
  }

  const {
    title,
    description,
    status,
    labels,
    assignees,
    relatedChangeRequests
  } = updateData
  const updates: Partial<Issue> = {}
  const labelsDiff: LabelsDiff = { add: [], remove: [] }
  const assigneesDiff: AssigneesDiff = { add: [], remove: [] }
  const relatedChangeRequestsDiff: RelatedChangeRequestsDiff = {
    add: [],
    remove: []
  }

  const existingLabelIds = existingIssue.labels.map(label => label.id)
  const existingAssigneeIds = existingIssue.assignees.map(
    assignee => assignee.user.id
  )
  const existingRelatedChangeRequests =
    existingIssue.related_change_requests.map(
      changeRequest => changeRequest.change_request_id
    )

  const newLabelIds = labels ? labels.map(label => label.id) : []
  const newAssigneeIds = assignees
    ? assignees.map(assignee => assignee.user.id)
    : []
  const newRelatedChangeRequests = relatedChangeRequests
    ? relatedChangeRequests.map(cr => cr.change_request_id)
    : []

  if (title && title !== existingIssue.title) {
    updates.title = title
  }

  if (description && description !== existingIssue.description) {
    updates.description = description
  }

  if (status && status !== existingIssue.status) {
    updates.status = status
  }

  if (labels && !unsortedStringArraysEqual(newLabelIds, existingLabelIds)) {
    const newLabelIds = labels.map(label => label.id)
    const existingLabelIds = existingIssue.labels.map(label => label.id)

    labelsDiff.add = labels.filter(
      label => !existingLabelIds.includes(label.id)
    )

    labelsDiff.remove = existingIssue.labels.filter(
      label => !newLabelIds.includes(label.id)
    )
  }

  if (
    assignees &&
    !unsortedStringArraysEqual(newAssigneeIds, existingAssigneeIds)
  ) {
    const newAssigneeIds = assignees.map(assignee => assignee.user.id)
    const existingAssigneeIds = existingIssue.assignees.map(
      assignee => assignee.user.id
    )

    assigneesDiff.add = assignees.filter(
      assignee => !existingAssigneeIds.includes(assignee.user.id)
    )

    assigneesDiff.remove = existingIssue.assignees.filter(
      assignee => !newAssigneeIds.includes(assignee.user.id)
    )
  }

  if (
    relatedChangeRequests &&
    !unsortedStringArraysEqual(
      newRelatedChangeRequests,
      existingRelatedChangeRequests
    )
  ) {
    const newRelatedChangeRequestIds = relatedChangeRequests.map(
      n => n.change_request_id
    )
    const existingRelatedChangeRequestIds =
      existingIssue.related_change_requests.map(n => n.change_request_id)

    relatedChangeRequestsDiff.add = relatedChangeRequests.filter(
      changeRequest =>
        !existingRelatedChangeRequestIds.includes(
          changeRequest.change_request_id
        )
    )

    relatedChangeRequestsDiff.remove =
      existingIssue.related_change_requests.filter(
        changeRequest =>
          !newRelatedChangeRequestIds.includes(changeRequest.change_request_id)
      )
  }

  // if there are no updates, return the existing issue
  if (
    !Object.keys(updates).length &&
    !labelsDiff.add.length &&
    !labelsDiff.remove.length &&
    !assigneesDiff.add.length &&
    !assigneesDiff.remove.length &&
    !relatedChangeRequestsDiff.add.length &&
    !relatedChangeRequestsDiff.remove.length
  ) {
    return existingIssue
  }

  updates.updated_at = new Date()

  try {
    return await getDb()
      .transaction()
      .execute(async trx => {
        let updatedIssue: Issue

        if (Object.keys(updates).length > 0) {
          const rawUpdatedIssue = await trx
            .updateTable('issue')
            .set(updates)
            .where('id', '=', existingIssue.id)
            .returningAll()
            .executeTakeFirstOrThrow()

          updatedIssue = {
            ...rawUpdatedIssue,
            connection_id: rawUpdatedIssue.metadata_database_connection_id,
            database_name: rawUpdatedIssue.metadata_database_raw_name,
            labels: [],
            assignees: [],
            related_change_requests: []
          }
        } else {
          updatedIssue = existingIssue
        }

        const currentDate = new Date()
        const ctx = {
          trx,
          issueId: updatedIssue.id,
          userId: where.user_id,
          currentDate
        } satisfies HistoryContext

        if (title && title !== existingIssue.title) {
          await addHistoryItem(ctx, 'UPDATE_TITLE', {
            prev: existingIssue.title,
            curr: title
          })
        }

        if (description && description !== existingIssue.description) {
          await addHistoryItem(ctx, 'UPDATE_DESCRIPTION', {
            prev: existingIssue.description,
            curr: description
          })
        }

        if (status === 'closed' && existingIssue.status === 'open') {
          await addHistoryItem(ctx, 'CLOSE_ISSUE', {
            issue_number: updatedIssue.issue_number
          })
        } else if (status === 'open' && existingIssue.status === 'closed') {
          await addHistoryItem(ctx, 'REOPEN_ISSUE', {
            issue_number: updatedIssue.issue_number
          })
        }

        if (labelsDiff.add.length) {
          await trx
            .insertInto('issue_label')
            .values(
              labelsDiff.add.map(label => ({
                issue_id: updatedIssue.id,
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
            .deleteFrom('issue_label')
            .where('issue_id', '=', existingIssue.id)
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

        if (assigneesDiff.add.length) {
          await trx
            .insertInto('issue_assignee')
            .values(
              assigneesDiff.add.map(assignee => ({
                issue_id: updatedIssue.id,
                user_id: assignee.user.id
              }))
            )
            .execute()

          await addHistoryItems(
            ctx,
            'ADD_ASSIGNEE',
            assigneesDiff.add.map(assignee => ({ assignee }))
          )
        }

        if (assigneesDiff.remove.length) {
          await trx
            .deleteFrom('issue_assignee')
            .where('issue_id', '=', existingIssue.id)
            .where(
              'user_id',
              'in',
              assigneesDiff.remove.map(assignee => assignee.user.id)
            )
            .execute()

          await addHistoryItems(
            ctx,
            'REMOVE_ASSIGNEE',
            assigneesDiff.remove.map(assignee => ({ assignee }))
          )
        }

        if (relatedChangeRequestsDiff.add.length) {
          for (const changeRequest of relatedChangeRequestsDiff.add) {
            await createRelation(
              changeRequest.change_request_id,
              updatedIssue.id,
              trx
            )
          }
        }

        if (relatedChangeRequestsDiff.remove.length) {
          for (const changeRequest of relatedChangeRequestsDiff.remove) {
            await deleteRelation(
              changeRequest.change_request_id,
              updatedIssue.id,
              trx
            )
          }
        }

        const getUpdatedIssue = await getIssue(
          {
            org_slug: where.issueData.org_slug,
            connection_id: where.issueData.connection_id,
            database_name: where.issueData.database_name,
            issue_number: where.issueData.issue_number
          },
          trx
        )

        return getUpdatedIssue!
      })
  } catch (error) {
    throw new Error('Failed to update issue', { cause: error })
  }
}

export const getIssueComment = async (id: string) => {
  try {
    return await getDb()
      .selectFrom('issue_comment')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()
  } catch (error) {
    throw new Error('Failed to get issue comment', { cause: error })
  }
}

export const createIssueComment = async (
  where: { org_slug: string; issue_id: string },
  issueCommentData: {
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
          .insertInto('issue_comment')
          .values({
            id: issueCommentData.id,
            issue_id: where.issue_id,
            created_by: issueCommentData.created_by,
            content: issueCommentData.content,
            created_at: now,
            updated_at: now
          })
          .returningAll()
          .executeTakeFirstOrThrow()

        await trx
          .insertInto('issue_history')
          .values({
            issue_id: where.issue_id,
            user_id: issueCommentData.created_by,
            action_type: 'ADD_COMMENT',
            action_details: JSON.stringify({
              comment_id: newComment.id,
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
      throw new Error('Issue does not exist', {
        cause: error
      })
    }
    throw new Error('Failed to create issue comment', { cause: error })
  }
}

export const updateIssueComment = async (issueCommentData: {
  id: string
  issue_id: string
  content: string
}) => {
  try {
    return await getDb()
      .transaction()
      .execute(async trx => {
        const now = new Date()

        const originalComment = await trx
          .selectFrom('issue_comment')
          .select(['id', 'content'])
          .where('id', '=', issueCommentData.id)
          .executeTakeFirstOrThrow()

        const updatedComment = await trx
          .updateTable('issue_comment')
          .set({
            content: issueCommentData.content,
            updated_at: now
          })
          .where('id', '=', issueCommentData.id)
          .returningAll()
          .executeTakeFirstOrThrow()

        await trx
          .insertInto('issue_history')
          .values({
            issue_id: issueCommentData.issue_id,
            user_id: updatedComment.created_by,
            action_type: 'UPDATE_COMMENT',
            action_details: JSON.stringify({
              comment_id: originalComment.id,
              content: updatedComment.content
            }),
            created_at: now
          })
          .execute()

        return updatedComment
      })
  } catch (error) {
    throw new Error('Failed to update issue comment', { cause: error })
  }
}

export const deleteIssueComment = async (issueCommentData: {
  id: string
  userId: string
  issue_id: string
}) => {
  try {
    if (!issueCommentData.id.trim()) {
      throw new Error('Invalid issue comment id provided')
    }

    return await getDb()
      .transaction()
      .execute(async trx => {
        const deletedComment = await trx
          .deleteFrom('issue_comment')
          .where('id', '=', issueCommentData.id)
          .returningAll()
          .executeTakeFirstOrThrow()

        await trx
          .insertInto('issue_history')
          .values({
            issue_id: issueCommentData.issue_id,
            user_id: issueCommentData.userId,
            action_type: 'REMOVE_COMMENT',
            action_details: JSON.stringify({
              comment_id: deletedComment.id,
              content: deletedComment.content
            }),
            created_at: new Date()
          })
          .execute()

        return deletedComment
      })
  } catch (error) {
    throw new Error('Failed to delete issue comment', { cause: error })
  }
}
