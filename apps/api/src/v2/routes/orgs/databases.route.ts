import * as DatabaseController from '../../controllers/database.controller'
import * as SnapshotController from '../../controllers/schema-import.controller'
import { checkAuthentication, addSchemas } from '../../utils/route.util'

import type { FastifyInstance } from 'fastify'

export const register = (server: FastifyInstance) => {
  addSchemas(server, [SnapshotController, DatabaseController])

  server.get(
    '/v2/orgs/:org_slug/databases',
    {
      schema: SnapshotController.getOrganizationDatabasesSchema,
      onRequest: checkAuthentication('isAccount')
    },
    SnapshotController.getOrganizationDatabases
  )

  server.get(
    '/v2/orgs/:org_slug/databases/:db_slug',
    {
      schema: DatabaseController.GetDatabase,
      onRequest: checkAuthentication('isAccount')
    },
    DatabaseController.getDatabase
  )

  server.patch(
    '/v2/orgs/:org_slug/databases/:db_slug',
    {
      schema: DatabaseController.UpdateDatabaseSchema,
      onRequest: checkAuthentication()
    },
    DatabaseController.updateDatabase
  )
}
