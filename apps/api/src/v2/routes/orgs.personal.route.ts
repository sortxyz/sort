import * as OrganizationController from '../controllers/org.controller'
import { checkAuthentication, addSchemas } from '../utils/route.util'

import type { FastifyInstance } from 'fastify'

/** Registers all /v2 Organization routes. */
export const register = (server: FastifyInstance) => {
  addSchemas(server, [OrganizationController])

  server.get(
    '/v2/my/orgs',
    {
      schema: OrganizationController.getMyOrganizationsSchema,
      onRequest: checkAuthentication()
    },
    OrganizationController.getMyOrganizations
  )
}
