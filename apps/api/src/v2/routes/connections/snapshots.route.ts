import * as SchemaImportController from '../../controllers/schema-import.controller'
import { checkAuthentication, addSchemas } from '../../utils/route.util'

import type { FastifyInstance } from 'fastify'

/** Registers all /v2 Schema Snapshot routes. */
export const register = (server: FastifyInstance) => {
  addSchemas(server, [SchemaImportController])

  server.post(
    '/v2/orgs/:org_slug/connections/:connection_id/schema',
    {
      schema: SchemaImportController.createSchemaSnapshotSchema,
      onRequest: checkAuthentication()
    },
    SchemaImportController.createSchemaSnapshot
  )
}
