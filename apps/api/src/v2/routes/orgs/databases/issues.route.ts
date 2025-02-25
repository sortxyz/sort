import * as IssueController from '../../../controllers/issue.controller'
import * as RelationController from '../../../controllers/relation.controller'
import { checkAuthentication, addSchemas } from '../../../utils/route.util'

import type { FastifyInstance } from 'fastify'

/** Registers all /v2 Issues routes. */
export const register = (server: FastifyInstance) => {
  addSchemas(server, [IssueController, RelationController])

  server.get(
    '/v2/orgs/:org_slug/databases/:db_slug/issues',
    {
      schema: IssueController.getIssuesSchema,
      onRequest: checkAuthentication('isAccount')
    },
    IssueController.getDatabaseIssues
  )

  server.get(
    '/v2/orgs/:org_slug/databases/:db_slug/issues/:issue_number',
    {
      schema: IssueController.getIssueSchema,
      onRequest: checkAuthentication('isAccount')
    },
    IssueController.getIssue
  )

  server.get(
    '/v2/orgs/:org_slug/databases/:db_slug/issues/:issue_number/relations',
    {
      schema: RelationController.getRelationsByIssueSchema,
      onRequest: checkAuthentication('isAccount')
    },
    RelationController.getRelationsByIssue
  )

  server.get(
    '/v2/orgs/:org_slug/databases/:db_slug/issues/:issue_number/history',
    {
      schema: IssueController.getIssueHistorySchema,
      onRequest: checkAuthentication('isAccount')
    },
    IssueController.getIssueHistory
  )

  server.get(
    '/v2/orgs/:org_slug/databases/:db_slug/issues/:issue_number/timeline',
    {
      schema: IssueController.getIssueTimelineSchema,
      onRequest: checkAuthentication('isAccount')
    },
    IssueController.getIssueTimeline
  )

  server.post(
    '/v2/orgs/:org_slug/databases/:db_slug/issues',
    {
      schema: IssueController.createIssueSchema,
      onRequest: checkAuthentication()
    },
    IssueController.createIssue
  )

  server.patch(
    '/v2/orgs/:org_slug/databases/:db_slug/issues/:issue_number',
    {
      schema: IssueController.updateIssueSchema,
      onRequest: checkAuthentication()
    },
    IssueController.updateIssue
  )

  server.post(
    '/v2/orgs/:org_slug/databases/:db_slug/issues/:issue_number/comments',
    {
      schema: IssueController.createIssueCommentSchema,
      onRequest: checkAuthentication()
    },
    IssueController.createIssueComment
  )

  server.patch(
    '/v2/orgs/:org_slug/databases/:db_slug/issues/:issue_number/comments/:comment_id',
    {
      schema: IssueController.updateIssueCommentSchema,
      onRequest: checkAuthentication()
    },
    IssueController.updateIssueComment
  )

  server.delete(
    '/v2/orgs/:org_slug/databases/:db_slug/issues/:issue_number/comments/:comment_id',
    {
      schema: IssueController.deleteIssueCommentSchema,
      onRequest: checkAuthentication()
    },
    IssueController.deleteIssueComment
  )
}
