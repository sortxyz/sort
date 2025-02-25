import * as OrganizationController from '../controllers/org.controller'
import { checkAuthentication, addSchemas } from '../utils/route.util'

import type { FastifyInstance } from 'fastify'

/** Registers all /v2 Organization routes. */
export const register = (server: FastifyInstance) => {
  addSchemas(server, [OrganizationController])

  server.post(
    '/v2/orgs',
    {
      schema: OrganizationController.createSchema,
      onRequest: checkAuthentication()
    },
    OrganizationController.create
  )

  server.get(
    '/v2/orgs/:org_slug',
    {
      schema: OrganizationController.getOrganizationBySlugSchema,
      onRequest: checkAuthentication('isAccount')
    },
    OrganizationController.getOrganizationBySlug
  )

  server.get(
    '/v2/orgs/:org_slug/dashboard',
    {
      schema: OrganizationController.GetOrganizationDashboardSchema,
      onRequest: checkAuthentication('isAccount')
    },
    OrganizationController.getOrganizationDashboard
  )

  server.patch(
    '/v2/orgs/:org_slug',
    {
      schema: OrganizationController.updateBySlugSchema,
      onRequest: checkAuthentication()
    },
    OrganizationController.updateBySlug
  )

  server.delete(
    '/v2/orgs/:org_slug',
    {
      schema: OrganizationController.removeBySlugSchema,
      onRequest: checkAuthentication()
    },
    OrganizationController.removeBySlug
  )
}
