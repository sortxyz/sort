import * as DatabaseController from '../../controllers/database.controller'
import { checkAuthentication, addSchemas } from '../../utils/route.util'

import type { FastifyInstance } from 'fastify'

export const register = (server: FastifyInstance) => {
  addSchemas(server, [DatabaseController])

  server.get(
    '/v2/orgs/:org_slug/databases/:db_slug/schemas',
    {
      schema: DatabaseController.getDatabaseSchemasSchema,
      onRequest: checkAuthentication('isAccount')
    },
    DatabaseController.getDatabaseSchemas
  )

  server.get(
    '/v2/orgs/:org_slug/databases/:db_slug/schemas/:schema_name/tables',
    {
      schema: DatabaseController.getSchemaTablesSchema,
      onRequest: checkAuthentication('isAccount')
    },
    DatabaseController.getSchemaTables
  )

  server.get(
    '/v2/orgs/:org_slug/databases/:db_slug/schemas/:schema_name/tables/:table_name/columns',
    {
      schema: DatabaseController.getTableColumnsSchema,
      onRequest: checkAuthentication('isAccount')
    },
    DatabaseController.getTableColumns
  )
}
