import { randomUUID } from 'node:crypto'

import { Type } from '@sinclair/typebox'
import { ChangeRequestNotificationSource } from '@sort/shared/constants/notifications.constant'
import {
  AuthHeadersSchema,
  GeneralErrorSchema,
  ValidationErrorSchema,
  createMessageSchema,
  UuidSchema,
  MarkdownColumnSchema
} from '@sort/shared/schemas/api.schema'
import { ChangeRequestNumberSchema } from '@sort/shared/schemas/change-request.schema'
import { DatabaseSlugSchema } from '@sort/shared/schemas/metadata.schema'
import { OrganizationSlugSchema } from '@sort/shared/schemas/org.schema'
import { ReviewSchema } from '@sort/shared/schemas/review.schema'
import * as ChangeRequestService from '@sort/shared/services/change-requests/change-request.service'
import * as ReviewPermissionsService from '@sort/shared/services/change-requests/review.permissions'
import * as ReviewService from '@sort/shared/services/change-requests/review.service'
import * as DatabaseMetadataService from '@sort/shared/services/kysely/metadata/database.service'
import { sendChangeRequestNotification } from '@sort/shared/services/notification.service'
import * as OrganizationService from '@sort/shared/services/org.service'
import { ReviewEventTypeSchema } from '@sort/shared/types/kysely.type'
import { mdToHtml } from '@sort/shared/utils/string.util'

import type {
  FastifyReplyTypebox,
  FastifyRequestTypebox
} from '../types/fastify.type'
import type { FastifySchema } from 'fastify'

export const getReviewsSchema = {
  headers: AuthHeadersSchema,
  summary: 'Get the active Reviews of a Change Request',
  operationId: 'list_reviews',
  tags: ['change_request'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema,
    change_request_number: ChangeRequestNumberSchema
  }),
  response: {
    200: createMessageSchema(
      'list_reviews',
      Type.Object({ reviews: Type.Array(ReviewSchema) })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    403: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const getReviews = async (
  request: FastifyRequestTypebox<typeof getReviewsSchema>,
  reply: FastifyReplyTypebox<typeof getReviewsSchema>
) => {
  const params = request.params
  const userId = request.sort.user.id

  const org = await OrganizationService.getBySlug(params.org_slug, userId)

  if (!org) {
    return reply.sendNotFound('organization')
  }

  const database = await DatabaseMetadataService.getDbByOrgAndDbSlug({
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

  const permCheck = await ReviewPermissionsService.validateReviewPermissions(
    database.connection_id,
    request.sort,
    org
  )

  if (permCheck === 404) {
    return reply.sendNotFound('database')
  } else if (permCheck === 403) {
    return reply.sendForbidden()
  }

  const reviews = await ReviewService.getReviews(changeRequest.id)

  return reply.send({
    type: 'list_reviews',
    payload: { reviews }
  })
}

export const getReviewSchema = {
  headers: AuthHeadersSchema,
  summary: 'Get a Change Request Review',
  operationId: 'get_review',
  tags: ['change_request'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema,
    change_request_number: ChangeRequestNumberSchema,
    review_id: UuidSchema
  }),
  response: {
    200: createMessageSchema(
      'get_review',
      Type.Object({ review: ReviewSchema })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    403: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const getReview = async (
  request: FastifyRequestTypebox<typeof getReviewSchema>,
  reply: FastifyReplyTypebox<typeof getReviewSchema>
) => {
  const params = request.params
  const userId = request.sort.user.id

  const org = await OrganizationService.getBySlug(params.org_slug, userId)

  if (!org) {
    return reply.sendNotFound('organization')
  }

  const database = await DatabaseMetadataService.getDbByOrgAndDbSlug({
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

  const permCheck = await ReviewPermissionsService.validateReviewPermissions(
    database.connection_id,
    request.sort,
    org
  )

  if (permCheck === 404) {
    return reply.sendNotFound('database')
  } else if (permCheck === 403) {
    return reply.sendForbidden()
  }

  const review = await ReviewService.getReview(params.review_id)

  if (!review) {
    return reply.sendNotFound('review')
  }

  const permissions = await ReviewPermissionsService.getReviewPermissions(
    review,
    changeRequest,
    org,
    request.sort
  )

  return reply.send({
    type: 'get_review',
    payload: { review: { ...review, permissions } }
  })
}

export const createReviewBodySchema = Type.Object({
  event_type: ReviewEventTypeSchema,
  text: Type.Optional(MarkdownColumnSchema)
})

export const createReviewSchema = {
  headers: AuthHeadersSchema,
  body: createReviewBodySchema,
  summary: 'Create a Change Request Review',
  operationId: 'create_review',
  tags: ['change_request'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema,
    change_request_number: ChangeRequestNumberSchema
  }),
  response: {
    201: createMessageSchema(
      'create_review',
      Type.Object({ review: ReviewSchema })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    403: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const createReview = async (
  request: FastifyRequestTypebox<typeof createReviewSchema>,
  reply: FastifyReplyTypebox<typeof createReviewSchema>
) => {
  const body = request.body
  const params = request.params
  const userId = request.sort.user.id

  const org = await OrganizationService.getBySlug(params.org_slug, userId)

  if (!org) {
    return reply.sendNotFound('organization')
  }

  const database = await DatabaseMetadataService.getDbByOrgAndDbSlug({
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

  const permCheck = await ReviewPermissionsService.validateReviewPermissions(
    database.connection_id,
    request.sort,
    org,
    {
      pub: { needsMember: true },
      prv: { needsMember: true }
    }
  )

  if (permCheck === 404) {
    return reply.sendNotFound('database')
  } else if (permCheck === 403) {
    return reply.sendForbidden()
  }

  const review = await ReviewService.createReview({
    id: randomUUID(),
    change_request_id: changeRequest.id,
    event_type: body.event_type,
    text: body.text ?? '',
    created_by: userId
  })

  const user = request.sort.user
  const username = user.username
  const text = body.text || ''

  const mdMessage =
    body.event_type === 'COMMENT'
      ? `@${username} commented\n---\n${text}`
      : `@${username} approved change request #${changeRequest.change_request_number}\n---\n${text}`

  const htmlMessage = await mdToHtml(
    body.event_type === 'COMMENT'
      ? `@${username} commented\n<hr>\n${text}`
      : `@${username} approved change request #${changeRequest.change_request_number}\n<hr>\n${text}`
  )

  const additionalRecipients =
    user.email && user.email_verified
      ? [
          {
            email: user.email,
            name: user.name || null
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
    source:
      body.event_type === 'APPROVE'
        ? ChangeRequestNotificationSource.UPDATE
        : ChangeRequestNotificationSource.COMMENT
  })

  return reply.status(201).send({
    type: 'create_review',
    payload: { review }
  })
}

export const updateReviewBodySchema = Type.Object({
  text: MarkdownColumnSchema
})

export const updateReviewSchema = {
  headers: AuthHeadersSchema,
  body: updateReviewBodySchema,
  summary: 'Update a Change Request Review comment',
  operationId: 'update_review',
  tags: ['change_request'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema,
    change_request_number: ChangeRequestNumberSchema,
    review_id: UuidSchema
  }),
  response: {
    200: createMessageSchema(
      'update_review',
      Type.Object({ review: ReviewSchema })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    403: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const updateReview = async (
  request: FastifyRequestTypebox<typeof updateReviewSchema>,
  reply: FastifyReplyTypebox<typeof updateReviewSchema>
) => {
  const body = request.body
  const params = request.params
  const userId = request.sort.user.id

  const org = await OrganizationService.getBySlug(params.org_slug, userId)

  if (!org) {
    return reply.sendNotFound('organization')
  }

  const database = await DatabaseMetadataService.getDbByOrgAndDbSlug({
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

  const review = await ReviewService.getReview(params.review_id)

  if (!review) {
    return reply.sendNotFound('review')
  }

  const permCheck = await ReviewPermissionsService.validateReviewPermissions(
    database.connection_id,
    request.sort,
    org,
    {
      isCreator: userId === review.created_by,
      pub: { needsCreator: true },
      prv: { needsCreator: true }
    }
  )

  if (permCheck === 404) {
    return reply.sendNotFound('database')
  } else if (permCheck === 403) {
    return reply.sendForbidden()
  }

  const updatedReview = await ReviewService.updateReview(
    { id: params.review_id, change_request_id: changeRequest.id },
    { text: body.text }
  )

  return reply.send({
    type: 'update_review',
    payload: { review: updatedReview }
  })
}
