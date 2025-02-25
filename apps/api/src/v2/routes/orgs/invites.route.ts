import * as OrganizationInviteController from '../../controllers/invite.controller'
import { checkAuthentication, addSchemas } from '../../utils/route.util'

import type { FastifyInstance } from 'fastify'

export function register(server: FastifyInstance) {
  addSchemas(server, [OrganizationInviteController])

  server.get(
    '/v2/orgs/:org_slug/invites',
    {
      schema: OrganizationInviteController.indexSchema,
      onRequest: checkAuthentication()
    },
    OrganizationInviteController.index
  )
  server.post(
    '/v2/orgs/:org_slug/invites',
    {
      schema: OrganizationInviteController.createSchema,
      onRequest: checkAuthentication()
    },
    OrganizationInviteController.create
  )

  server.get(
    '/v2/orgs/:org_slug/invites/:invite_id',
    {
      schema: OrganizationInviteController.showSchema,
      onRequest: checkAuthentication()
    },
    OrganizationInviteController.show
  )

  server.patch(
    '/v2/orgs/:org_slug/invites/:invite_id',
    {
      schema: OrganizationInviteController.updateSchema,
      onRequest: checkAuthentication()
    },
    OrganizationInviteController.update
  )
}
