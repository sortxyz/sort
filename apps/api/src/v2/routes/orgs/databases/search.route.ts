import * as ChangeRequestsController from '../../../controllers/change-request.controller'
import * as IssueController from '../../../controllers/issue.controller'
import { checkAuthentication, addSchemas } from '../../../utils/route.util'

import type { FastifyInstance } from 'fastify'

export const register = (server: FastifyInstance) => {
  addSchemas(server, [ChangeRequestsController, IssueController])

  server.get(
    '/v2/orgs/:org_slug/databases/:db_slug/search/change-requests',
    {
      schema: ChangeRequestsController.searchChangeRequestsSchema,
      onRequest: checkAuthentication('isAccount')
    },
    ChangeRequestsController.searchDatabaseChangeRequests
  )

  server.get(
    '/v2/orgs/:org_slug/databases/:db_slug/search/issues',
    {
      schema: IssueController.searchIssuesSchema,
      onRequest: checkAuthentication('isAccount')
    },
    IssueController.searchDatabaseIssues
  )
}
