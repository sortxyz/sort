import * as QueryController from '../../controllers/query.controller'
import { checkAuthentication, addSchemas } from '../../utils/route.util'

import type { FastifyInstance } from 'fastify'

export const register = (server: FastifyInstance) => {
  addSchemas(server, [QueryController])

  server.post(
    '/v2/orgs/:org_slug/query',
    {
      schema: QueryController.runQuerySchema,
      onRequest: checkAuthentication('isAccount')
    },
    QueryController.run
  )

  server.get(
    '/v2/orgs/:org_slug/queries',
    {
      schema: QueryController.ListQueriesSchema,
      onRequest: checkAuthentication('isAccount')
    },
    QueryController.listQueries
  )

  server.post(
    '/v2/orgs/:org_slug/queries',
    {
      schema: QueryController.CreateQuerySchema,
      onRequest: checkAuthentication()
    },
    QueryController.createQuery
  )

  server.get(
    '/v2/orgs/:org_slug/queries/:query_id',
    {
      schema: QueryController.GetQuerySchema,
      onRequest: checkAuthentication('isAccount')
    },
    QueryController.getQuery
  )

  server.patch(
    '/v2/orgs/:org_slug/queries/:query_id',
    {
      schema: QueryController.UpdateQuerySchema,
      onRequest: checkAuthentication()
    },
    QueryController.updateQuery
  )

  server.delete(
    '/v2/orgs/:org_slug/queries/:query_id',
    {
      schema: QueryController.DeleteQuerySchema,
      onRequest: checkAuthentication()
    },
    QueryController.deleteQuery
  )
}
