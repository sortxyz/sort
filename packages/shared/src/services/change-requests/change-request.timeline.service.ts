import { getDb } from '../../'
import * as LabelService from '../label.service'

import { getChangeRequestCommentPermissions } from './change-request.permissions'

import type {
  ChangeRequestHistory,
  ActionDetails,
  ActionDetailsReview,
  ActionDetailsComment
} from '../../schemas/change-request-history.schema'
import type { FullChangeRequestResponse } from '../../schemas/change-request.schema'
import type { Organization } from '../../schemas/org.schema'
import type { SortContext } from '../../types/sort-context.type'

export const getChangeRequestTimeline = async (change_request_id: string) => {
  const events = await fetchTimelineEvents(change_request_id)
  const { eventsMap, removals } = processEvents(events)
  return await finalizeTimeline(eventsMap, removals)
}

const fetchTimelineEvents = async (change_request_id: string) => {
  const timelineRows = await getDb()
    .selectFrom('change_request_history')
    .innerJoin('user', 'user.id', 'change_request_history.user_id')
    .select([
      'change_request_history.id',
      'change_request_history.change_request_id',
      'change_request_history.action_type',
      'change_request_history.action_details',
      'change_request_history.created_at',
      'user.id as user_id',
      'user.name as user_name',
      'user.username as user_username',
      'user.picture as user_picture'
    ])
    .where('change_request_id', '=', change_request_id)
    .orderBy('created_at', 'asc')
    .execute()

  return timelineRows.map(row => ({
    id: row.id,
    change_request_id: row.change_request_id,
    user: {
      id: row.user_id,
      name: row.user_name,
      username: row.user_username,
      picture: row.user_picture
    },
    action_type: row.action_type,
    action_details: row.action_details,
    created_at: row.created_at
  })) as ChangeRequestHistory[]
}

const processEvents = (events: ChangeRequestHistory[]) => {
  const eventsMap = new Map<string, ChangeRequestHistory>()
  const originalTimes = new Map<string, Date>() // To store the original creation times
  const removals = new Set<string>()

  events.forEach(event => {
    const details = event.action_details

    switch (event.action_type) {
      case 'REMOVE_COMMENT':
        if (isCommentActionDetails(details)) {
          removals.add(details.comment_id)
        }
        break

      case 'ADD_COMMENT':
        if (
          isCommentActionDetails(details) &&
          !removals.has(details.comment_id)
        ) {
          originalTimes.set(details.comment_id, event.created_at)
          eventsMap.set(details.comment_id, event)
        }
        break

      case 'UPDATE_COMMENT':
        if (
          isCommentActionDetails(details) &&
          !removals.has(details.comment_id)
        ) {
          const originalTime = originalTimes.get(details.comment_id)
          if (originalTime) {
            event.created_at = originalTime
          }
          eventsMap.set(details.comment_id, event)
        }
        break

      case 'ADD_REVIEW':
        if (isReviewActionDetails(details)) {
          originalTimes.set(details.review_id, event.created_at)
          eventsMap.set(details.review_id, event)
        }
        break

      case 'UPDATE_REVIEW':
        if (isReviewActionDetails(details)) {
          const originalTime = originalTimes.get(details.review_id)
          if (originalTime) {
            event.created_at = originalTime
          }
          eventsMap.set(details.review_id, event)
        }
        break

      default:
        eventsMap.set(event.id, event)
    }
  })

  return { eventsMap, removals }
}

const finalizeTimeline = async (
  eventsMap: Map<string, ChangeRequestHistory>,
  removals: Set<string>
) => {
  let timeline = Array.from(eventsMap.values()).filter(event => {
    const details = event.action_details as ActionDetailsComment
    return !(
      isCommentActionDetails(details) && removals.has(details.comment_id)
    )
  })

  timeline = await updateLabelDetails(timeline) // Update labels with the latest details

  timeline = timeline.sort(
    (a, b) => a.created_at.getTime() - b.created_at.getTime()
  )

  // Create event may happen at same time as add label/assignee, ensure it's first
  const createEventIndex = timeline.findIndex(
    event => event.action_type === 'CREATE_CHANGE_REQUEST'
  )
  if (createEventIndex !== 0) {
    const [createEvent] = timeline.splice(createEventIndex, 1)
    timeline.unshift(createEvent)
  }

  return timeline
}

const updateLabelDetails = async (timeline: ChangeRequestHistory[]) => {
  const labelUpdatePromises = timeline.map(async event => {
    if (
      event.action_type === 'ADD_LABEL' ||
      event.action_type === 'REMOVE_LABEL'
    ) {
      const labelDetails = event.action_details
      const updatedLabel = await LabelService.getLabel(labelDetails.label.id)
      if (updatedLabel) {
        labelDetails.label = updatedLabel
      }
    }
    return event
  })

  return Promise.all(labelUpdatePromises)
}

function isCommentActionDetails(
  details: ActionDetails
): details is ActionDetailsComment {
  return 'comment_id' in details
}

function isReviewActionDetails(
  details: ActionDetails
): details is ActionDetailsReview {
  return 'review_id' in details
}

export const attachCommentPermissions = async (
  timeline: ChangeRequestHistory[],
  changeRequest: FullChangeRequestResponse,
  org: Organization,
  ctx: SortContext
) => {
  for (const event of timeline) {
    if (
      event.action_type === 'ADD_COMMENT' ||
      event.action_type === 'UPDATE_COMMENT'
    ) {
      event.permissions = await getChangeRequestCommentPermissions(
        changeRequest,
        event.user.id,
        org,
        ctx
      )
    }
  }

  return timeline
}
