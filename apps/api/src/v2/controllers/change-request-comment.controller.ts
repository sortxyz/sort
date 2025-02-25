import { randomUUID } from 'node:crypto'

import { Type } from '@sinclair/typebox'
import { ChangeRequestNotificationSource } from '@sort/shared/constants/notifications.constant'
import {
  AuthHeadersSchema,
  GeneralErrorSchema,
  GeneralSuccessSchema,
  ValidationErrorSchema,
  createMessageSchema,
  UuidSchema
} from '@sort/shared/schemas/api.schema'
import * as ChangeRequestCommentSchema from '@sort/shared/schemas/change-request-comment.schema'
import { ChangeRequestNumberSchema } from '@sort/shared/schemas/change-request.schema'
import { DatabaseSlugSchema } from '@sort/shared/schemas/metadata.schema'
import { OrganizationSlugSchema } from '@sort/shared/schemas/org.schema'
import * as ChangeRequestPermissionService from '@sort/shared/services/change-requests/change-request.permissions'
import * as ChangeRequestService from '@sort/shared/services/change-requests/change-request.service'
import * as ReviewService from '@sort/shared/services/change-requests/review.service'
import * as ChangeService from '@sort/shared/services/changes/change.service'
import * as ConnectionService from '@sort/shared/services/connection.service'
import * as MetadataDatabaseService from '@sort/shared/services/kysely/metadata/database.service'
import { sendChangeRequestNotification } from '@sort/shared/services/notification.service'
import * as OrganizationService from '@sort/shared/services/org.service'
import { mdToHtml } from '@sort/shared/utils/string.util'

import type {
  FastifyReplyTypebox,
  FastifyRequestTypebox
} from '../types/fastify.type'
import type { FastifySchema } from 'fastify'

const createChangeRequestCommentBodySchema = Type.Object({
  content: ChangeRequestCommentSchema.ChangeRequestCommentContentSchema,
  change_id: Type.Optional(UuidSchema),
  review_id: Type.Optional(UuidSchema)
})

export const createCommentSchema = {
  headers: AuthHeadersSchema,
  body: createChangeRequestCommentBodySchema,
  summary: 'Create a Change Request Comment',
  operationId: 'create_change_request_comment',
  tags: ['change_request'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema,
    change_request_number: ChangeRequestNumberSchema
  }),
  response: {
    201: createMessageSchema(
      'create_change_request_comment',
      Type.Object({
        change_request_comment:
          ChangeRequestCommentSchema.ChangeRequestCommentSchema
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    403: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

/**
 * Creates a change request comment.
 *
 * The scope of the comment depends on the optional `change_id` and `review_id` fields on the request body's optional.
 *
 * Providing:
 *
 * - Both `change_id` and `review_id`:
 *     - Comment specific to an individual change and part of a specific review.
 * - Only `change_id`:
 *   - Comment specific to an individual change, but not part of or in response to a review.
 * - Only `review_id`:
 *   - Top-level review comment. (Not about a specific change.)
 * - Neither `change_id` or `review_id`:
 *   - Top-level change request comment. (Not about a specific change or part of any review.)
 */
export const createComment = async (
  request: FastifyRequestTypebox<typeof createCommentSchema>,
  reply: FastifyReplyTypebox<typeof createCommentSchema>
) => {
  const body = request.body
  const params = request.params
  const userId = request.sort.user.id

  const org = await OrganizationService.getBySlug(
    params.org_slug,
    request.sort.user.id
  )

  if (!org) {
    return reply.sendNotFound('organization')
  }

  const connection = await ConnectionService.getByOrgAndDbSlug({
    orgSlug: org.slug,
    dbSlug: params.db_slug
  })

  if (!connection) {
    return reply.sendNotFound('database')
  }

  const permCheck =
    await ChangeRequestPermissionService.validateChangeRequestPermissions(
      connection.id,
      request.sort,
      org,
      {
        pub: { needsCustomerAccount: false }
      }
    )
  if (permCheck === 404) {
    return reply.sendNotFound('database')
  } else if (permCheck === 403) {
    return reply.sendForbidden()
  }

  const database = await MetadataDatabaseService.getDbByOrgAndDbSlug({
    orgSlug: org.slug,
    dbSlug: params.db_slug
  })

  if (!database) {
    return reply.sendNotFound('database')
  }

  const changeRequest = await ChangeRequestService.getFullChangeRequestResponse(
    {
      org_slug: org.slug,
      connection_id: database.connection_id,
      database_name: database.raw_name,
      change_request_number: params.change_request_number
    }
  )

  if (!changeRequest) {
    return reply.sendNotFound('change request')
  }

  let review
  if (body.review_id) {
    review = await ReviewService.getReview(body.review_id)
    if (!review || changeRequest.id !== review.change_request_id) {
      return reply.sendNotFound('review')
    }
  }

  let change
  if (body.change_id) {
    change = await ChangeService.getChange(body.change_id)
    if (!change || changeRequest.id !== change.change_request_id) {
      return reply.sendNotFound('change')
    }
  }

  let changeRequestComment: ChangeRequestCommentSchema.ChangeRequestComment
  try {
    changeRequestComment =
      await ChangeRequestService.createChangeRequestComment(
        {
          org_slug: org.slug,
          change_request_id: changeRequest.id,
          change_id: body.change_id,
          review_id: body.review_id
        },
        {
          id: randomUUID(),
          created_by: userId,
          content: body.content
        }
      )
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'Failed to get change request by change_request_number'
    ) {
      return reply.sendNotFound('change request')
    }

    throw error
  }

  const username = request.sort.user.username
  const mdMessage = `@${username} commented\n---\n${body.content}`
  const htmlMessage = await mdToHtml(
    `@${username} commented\n<hr>\n${body.content}`
  )
  const additionalRecipients =
    request.sort.user.email && request.sort.user.email_verified
      ? [
          {
            email: request.sort.user.email,
            name: request.sort.user.name || null
          }
        ]
      : []

  await sendChangeRequestNotification({
    org,
    database,
    changeRequest,
    htmlMessage,
    mdMessage,
    logger: request.log,
    additionalRecipients,
    source: ChangeRequestNotificationSource.COMMENT
  })

  return reply.status(201).send({
    type: 'create_change_request_comment',
    payload: { change_request_comment: changeRequestComment }
  })
}

export const updateCommentSchema = {
  headers: AuthHeadersSchema,
  body: Type.Omit(createChangeRequestCommentBodySchema, ['id']),
  summary: 'Update a Change Request Comment',
  operationId: 'update_change_request_comment',
  tags: ['change_request'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema,
    change_request_number: ChangeRequestNumberSchema,
    comment_id: UuidSchema
  }),
  response: {
    200: createMessageSchema(
      'update_change_request_comment',
      Type.Object({
        change_request_comment:
          ChangeRequestCommentSchema.ChangeRequestCommentSchema
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    403: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const updateComment = async (
  request: FastifyRequestTypebox<typeof updateCommentSchema>,
  reply: FastifyReplyTypebox<typeof updateCommentSchema>
) => {
  const body = request.body
  const params = request.params
  const userId = request.sort.user.id

  const org = await OrganizationService.getBySlug(params.org_slug, userId)

  if (!org) {
    return reply.sendNotFound('organization')
  }

  const database = await MetadataDatabaseService.getDbByOrgAndDbSlug({
    orgSlug: org.slug,
    dbSlug: params.db_slug
  })

  if (!database) {
    return reply.sendNotFound('database')
  }

  const changeRequest = await ChangeRequestService.getFullChangeRequestResponse(
    {
      org_slug: org.slug,
      connection_id: database.connection_id,
      database_name: database.raw_name,
      change_request_number: params.change_request_number
    }
  )

  if (!changeRequest) {
    return reply.sendNotFound('change request')
  }

  const changeRequestComment =
    await ChangeRequestService.getChangeRequestComment(params.comment_id)

  if (!changeRequestComment) {
    return reply.sendNotFound('change request comment')
  }

  const permCheck =
    await ChangeRequestPermissionService.validateChangeRequestPermissions(
      database.connection_id,
      request.sort,
      org,
      ChangeRequestPermissionService.updateCommentPermissionValues(
        changeRequestComment.created_by === userId
      )
    )
  if (permCheck === 404) {
    return reply.sendNotFound('database')
  } else if (permCheck === 403) {
    return reply.sendForbidden()
  }

  const updatedChangeRequestComment =
    await ChangeRequestService.updateChangeRequestComment({
      id: changeRequestComment.id,
      change_request_id: changeRequest.id,
      content: body.content
    })

  return reply.status(200).send({
    type: 'update_change_request_comment',
    payload: { change_request_comment: updatedChangeRequestComment }
  })
}

export const deleteCommentSchema = {
  headers: AuthHeadersSchema,
  summary: 'Delete a Change Request Comment',
  operationId: 'delete_change_request_comment',
  tags: ['change_request'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema,
    change_request_number: ChangeRequestNumberSchema,
    comment_id: UuidSchema
  }),
  response: {
    200: GeneralSuccessSchema,
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    403: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const deleteComment = async (
  request: FastifyRequestTypebox<typeof deleteCommentSchema>,
  reply: FastifyReplyTypebox<typeof deleteCommentSchema>
) => {
  const params = request.params
  const userId = request.sort.user.id

  const org = await OrganizationService.getBySlug(
    params.org_slug,
    request.sort.user.id
  )

  if (!org) {
    return reply.sendNotFound('organization')
  }

  const database = await MetadataDatabaseService.getDbByOrgAndDbSlug({
    orgSlug: org.slug,
    dbSlug: params.db_slug
  })

  if (!database) {
    return reply.sendNotFound('database')
  }

  const changeRequest = await ChangeRequestService.getFullChangeRequestResponse(
    {
      org_slug: org.slug,
      connection_id: database.connection_id,
      database_name: database.raw_name,
      change_request_number: params.change_request_number
    }
  )

  if (!changeRequest) {
    return reply.sendNotFound('change request')
  }

  const changeRequestComment =
    await ChangeRequestService.getChangeRequestComment(params.comment_id)

  if (!changeRequestComment) {
    return reply.sendNotFound('change request comment')
  }

  const permCheck =
    await ChangeRequestPermissionService.validateChangeRequestPermissions(
      database.connection_id,
      request.sort,
      org,
      ChangeRequestPermissionService.deleteCommentPermissionValues(
        changeRequestComment.created_by === userId
      )
    )
  if (permCheck === 404) {
    return reply.sendNotFound('database')
  } else if (permCheck === 403) {
    return reply.sendForbidden()
  }

  await ChangeRequestService.deleteChangeRequestComment({
    id: changeRequestComment.id,
    userId: userId,
    change_request_id: changeRequest.id
  })

  return reply.send({
    type: 'success',
    payload: {
      success: {
        message: `Change Request comment ${params.comment_id} deleted successfully.`
      }
    }
  })
}
