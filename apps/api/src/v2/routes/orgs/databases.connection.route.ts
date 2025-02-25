import * as DatabaseController from '../../controllers/database.controller'
import { checkAuthentication, addSchemas } from '../../utils/route.util'

import type { FastifyInstance } from 'fastify'

export const register = (server: FastifyInstance) => {
  addSchemas(server, [DatabaseController])

  server.get(
    '/v2/orgs/:org_slug/databases/:db_slug/connection',
    {
      schema: DatabaseController.GetDatabaseConnectionSchema,
      onRequest: checkAuthentication('isAccount')
    },
    DatabaseController.getDatabaseConnection
  )
}
