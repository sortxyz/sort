import * as ConnectionController from '../../controllers/connection.controller'
import { checkAuthentication, addSchemas } from '../../utils/route.util'

import type { FastifyInstance } from 'fastify'

/** Registers all /v2 Connection routes. */
export const register = (server: FastifyInstance) => {
  addSchemas(server, [ConnectionController])

  server.get(
    '/v2/orgs/:org_slug/connections',
    {
      schema: ConnectionController.getOrganizationConnectionsSchema,
      onRequest: checkAuthentication()
    },
    ConnectionController.getOrganizationConnections
  )

  server.post(
    '/v2/orgs/:org_slug/connections',
    {
      schema: ConnectionController.createConnectionSchema,
      onRequest: checkAuthentication()
    },
    ConnectionController.create
  )

  server.post(
    '/v2/orgs/:org_slug/connections/test',
    {
      schema: ConnectionController.testConnectionSchema,
      onRequest: checkAuthentication()
    },
    ConnectionController.test
  )

  server.get(
    '/v2/orgs/:org_slug/connections/:connection_id',
    {
      schema: ConnectionController.getOrganizationConnectionSchema,
      onRequest: checkAuthentication()
    },
    ConnectionController.getOrganizationConnection
  )

  server.patch(
    '/v2/orgs/:org_slug/connections/:connection_id',
    {
      schema: ConnectionController.updateConnectionSchema,
      onRequest: checkAuthentication()
    },
    ConnectionController.update
  )

  server.delete(
    '/v2/orgs/:org_slug/connections/:connection_id',
    {
      schema: ConnectionController.deleteConnectionSchema,
      onRequest: checkAuthentication()
    },
    ConnectionController.deleteConnection
  )
}
