import { serverErrorHandler, notFoundHandler } from '../utils/route.util'

import { register as registerConnectionRoutes } from './connections/connections.route'
import { register as registerConnectionSnapshotRoutes } from './connections/snapshots.route'
import { register as registerOrgDatabaseChangeRequestRoutes } from './orgs/databases/change-requests.route'
import { register as registerOrgDatabaseIssueRoutes } from './orgs/databases/issues.route'
import { register as registerLabelRoutes } from './orgs/databases/labels.route'
import { register as registerOrgDatabaseSearchRoutes } from './orgs/databases/search.route'
import { register as registerOrgDatabaseConnectionRoutes } from './orgs/databases.connection.route'
import { register as registerOrgDatabaseRoutes } from './orgs/databases.route'
import { register as registerOrgDatabaseSchemaRoutes } from './orgs/databases.schema.route'
import { register as registerOrgInviteRoutes } from './orgs/invites.route'
import { register as registerQueryRoutes } from './orgs/queries.route'
import { register as registerOrgMembersRoutes } from './orgs.members.route'
import { register as registerOrgPersonalRoutes } from './orgs.personal.route'
import { register as registerOrgRoutes } from './orgs.route'
import { register as registerSearchRoute } from './search.route'
import { register as registerSpecialHomeRoute } from './special/home.route'
import { register as registerSpecialUserRoutes } from './special/users.route'
import { register as registerUserRoutes } from './users.route'

import type { Auth0JWT } from '../types/jwt.type'
import type { FastifyInstance } from 'fastify'

declare module 'fastify' {
  interface FastifyRequest {
    auth0: Auth0JWT
  }
}

export const register = (server: FastifyInstance) => {
  void server.register((server, _opts, done) => {
    server.setErrorHandler(serverErrorHandler)
    server.setNotFoundHandler(notFoundHandler)

    // verb ordering for these routes: POST, GET, PATCH, DELETE, OPTIONS

    // /v2/my
    registerUserRoutes(server)
    registerOrgPersonalRoutes(server)

    // /v2/orgs
    registerOrgRoutes(server)

    // /v2/orgs/connections
    registerConnectionRoutes(server)
    registerConnectionSnapshotRoutes(server)

    // /v2/orgs/databases
    registerOrgDatabaseRoutes(server)

    // /v2/orgs/databases/change-requests
    registerOrgDatabaseChangeRequestRoutes(server)

    // /v2/orgs/databases/connection
    registerOrgDatabaseConnectionRoutes(server)

    // /v2/orgs/databases/issues
    registerOrgDatabaseIssueRoutes(server)

    // /v2/orgs/databases/labels
    registerLabelRoutes(server)

    // /v2/orgs/databases/schemas
    registerOrgDatabaseSchemaRoutes(server)

    // /v2/orgs/databases/search
    registerOrgDatabaseSearchRoutes(server)

    // /v2/orgs/invites
    registerOrgInviteRoutes(server)

    // /v2/orgs/members
    registerOrgMembersRoutes(server)

    // /v2/orgs/queries
    registerQueryRoutes(server)

    // /v2/search
    registerSearchRoute(server)

    // /v2/special
    registerSpecialUserRoutes(server)
    registerSpecialHomeRoute(server)

    server.decorateRequest('auth0', null)

    done()
  })
}
