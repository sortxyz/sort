import * as UserController from '../../controllers/special/user.controller'
import { validateAuth0JWT, checkAuthentication } from '../../utils/route.util'

import type { FastifyInstance } from 'fastify'

export const register = (server: FastifyInstance) => {
  server.put(
    '/v2/special/users',
    {
      schema: UserController.initializeUserSchema,
      onRequest: validateAuth0JWT
    },
    UserController.initializeUser
  )

  server.post(
    '/v2/special/users/revoke-sessions',
    {
      schema: UserController.revokeSessionsSchema
    },
    UserController.revokeSessions
  )

  server.patch(
    '/v2/special/users/verify-email',
    {
      schema: UserController.VerifyEmailBodySchema,
      onRequest: checkAuthentication('isCustomerAccount')
    },
    UserController.verifyEmail
  )

  server.put(
    '/v2/special/onprem/users',
    {
      schema: UserController.initializeOnPremUserSchema
    },
    UserController.initializeOnPremUser
  )
}
