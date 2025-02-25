import * as CommentController from '../../../controllers/change-request-comment.controller'
import * as ChangeRequestsController from '../../../controllers/change-request.controller'
import * as ChangeController from '../../../controllers/change.controller'
import * as RelationController from '../../../controllers/relation.controller'
import * as ReviewController from '../../../controllers/review.controller'
import { checkAuthentication, addSchemas } from '../../../utils/route.util'

import type { FastifyInstance } from 'fastify'

/** Registers all /v2 Change Requests routes. */
export const register = (server: FastifyInstance) => {
  addSchemas(server, [
    ChangeRequestsController,
    ChangeController,
    CommentController,
    ReviewController,
    RelationController
  ])

  server.get(
    '/v2/orgs/:org_slug/databases/:db_slug/change-requests',
    {
      schema: ChangeRequestsController.getChangeRequestsSchema,
      onRequest: checkAuthentication('isAccount')
    },
    ChangeRequestsController.getDatabaseChangeRequests
  )

  server.post(
    '/v2/orgs/:org_slug/databases/:db_slug/change-requests',
    {
      schema: ChangeRequestsController.createChangeRequestSchema,
      onRequest: checkAuthentication()
    },
    ChangeRequestsController.createChangeRequest
  )

  server.get(
    '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number',
    {
      schema: ChangeRequestsController.getChangeRequestSchema,
      onRequest: checkAuthentication('isAccount')
    },
    ChangeRequestsController.getChangeRequest
  )

  server.patch(
    '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number',
    {
      schema: ChangeRequestsController.updateChangeRequestSchema,
      onRequest: checkAuthentication()
    },
    ChangeRequestsController.updateChangeRequest
  )

  server.post(
    '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/undo',
    {
      schema: ChangeRequestsController.CreateUndoChangeRequestSchema,
      onRequest: checkAuthentication()
    },
    ChangeRequestsController.createUndoChangeRequest
  )

  server.get(
    '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/changes',
    {
      schema: ChangeController.getChangesSchema,
      onRequest: checkAuthentication('isAccount')
    },
    ChangeController.getChanges
  )

  server.post(
    '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/changes/batch',
    {
      schema: ChangeController.CreateChangesSchema,
      onRequest: checkAuthentication()
    },
    ChangeController.createChanges
  )

  server.patch(
    '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/changes/:change_id',
    {
      schema: ChangeController.updateChangeSchema,
      onRequest: checkAuthentication()
    },
    ChangeController.updateChange
  )

  server.delete(
    '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/changes/:change_id',
    {
      schema: ChangeController.deleteChangeSchema,
      onRequest: checkAuthentication()
    },
    ChangeController.deleteChange
  )

  server.post(
    '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/comments',
    {
      schema: CommentController.createCommentSchema,
      onRequest: checkAuthentication()
    },
    CommentController.createComment
  )

  server.patch(
    '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/comments/:comment_id',
    {
      schema: CommentController.updateCommentSchema,
      onRequest: checkAuthentication()
    },
    CommentController.updateComment
  )

  server.delete(
    '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/comments/:comment_id',
    {
      schema: CommentController.deleteCommentSchema,
      onRequest: checkAuthentication()
    },
    CommentController.deleteComment
  )

  server.patch(
    '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/execute',
    {
      schema: ChangeRequestsController.executeChangeRequestSchema,
      onRequest: checkAuthentication()
    },
    ChangeRequestsController.executeChangeRequest
  )

  server.get(
    '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/relations',
    {
      schema: RelationController.getRelationsByChangeRequestSchema,
      onRequest: checkAuthentication('isAccount')
    },
    RelationController.getRelationsByChangeRequest
  )

  server.post(
    '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/relations',
    {
      schema: RelationController.createRelationSchema,
      onRequest: checkAuthentication()
    },
    RelationController.createRelation
  )

  server.delete(
    '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/relations',
    {
      schema: RelationController.deleteRelationSchema,
      onRequest: checkAuthentication()
    },
    RelationController.deleteRelation
  )

  server.get(
    '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/reviews',
    {
      schema: ReviewController.getReviewsSchema,
      onRequest: checkAuthentication()
    },
    ReviewController.getReviews
  )

  server.post(
    '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/reviews',
    {
      schema: ReviewController.createReviewSchema,
      onRequest: checkAuthentication()
    },
    ReviewController.createReview
  )

  server.get(
    '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/reviews/:review_id',
    {
      schema: ReviewController.getReviewSchema,
      onRequest: checkAuthentication()
    },
    ReviewController.getReview
  )

  server.patch(
    '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/reviews/:review_id',
    {
      schema: ReviewController.updateReviewSchema,
      onRequest: checkAuthentication()
    },
    ReviewController.updateReview
  )

  server.get(
    '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/timeline',
    {
      schema: ChangeRequestsController.getChangeRequestTimelineSchema,
      onRequest: checkAuthentication('isAccount')
    },
    ChangeRequestsController.getChangeRequestTimeline
  )
}
