import * as OrganizationController from '../controllers/org.controller'
import { checkAuthentication, addSchemas } from '../utils/route.util'

import type { FastifyInstance } from 'fastify'

/** Registers all /v2 Organization routes. */
export const register = (server: FastifyInstance) => {
  addSchemas(server, [OrganizationController])

  server.get(
    '/v2/orgs/:org_slug/members',
    {
      schema: OrganizationController.getMembersSchema,
      onRequest: checkAuthentication('isAccount')
    },
    OrganizationController.getMembers
  )

  server.patch(
    '/v2/orgs/:org_slug/members/:username',
    {
      schema: OrganizationController.updateMemberSchema,
      onRequest: checkAuthentication()
    },
    OrganizationController.updateMember
  )

  server.delete(
    '/v2/orgs/:org_slug/members/:username',
    {
      schema: OrganizationController.removeMemberSchema,
      onRequest: checkAuthentication()
    },
    OrganizationController.removeMember
  )
}
