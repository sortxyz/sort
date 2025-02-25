import * as APIKeyController from '../controllers/apikey.controller'
import * as SubscriptionController from '../controllers/subscription.controller'
import * as UserController from '../controllers/user.controller'
import { checkAuthentication, addSchemas } from '../utils/route.util'

import type { FastifyInstance } from 'fastify'

export const register = (server: FastifyInstance) => {
  addSchemas(server, [UserController, SubscriptionController, APIKeyController])

  server.get(
    '/v2/my/profile',
    {
      schema: UserController.GetUserProfileSchema,
      onRequest: checkAuthentication()
    },
    UserController.getUserProfile
  )

  server.patch(
    '/v2/my/profile',
    {
      schema: UserController.UpdateUserProfileSchema,
      onRequest: checkAuthentication()
    },
    UserController.updateUserProfile
  )

  server.delete(
    '/v2/my/profile',
    {
      schema: UserController.RemoveUserProfileSchema,
      onRequest: checkAuthentication()
    },
    UserController.removeUserProfile
  )

  server.post(
    '/v2/my/profile/verify-email',
    {
      schema: UserController.SendVerificationEmailSchema,
      onRequest: checkAuthentication()
    },
    UserController.sendVerificationEmailToUser
  )

  // api keys

  server.get(
    '/v2/my/api-keys',
    {
      schema: APIKeyController.ListAPIKeysSchema,
      onRequest: checkAuthentication()
    },
    APIKeyController.listAPIKeys
  )

  server.post(
    '/v2/my/api-keys',
    {
      schema: APIKeyController.CreateAPIKeySchema,
      onRequest: checkAuthentication()
    },
    APIKeyController.createAPIKey
  )

  server.patch(
    '/v2/my/api-keys/:api_key_id',
    {
      schema: APIKeyController.UpdateAPIKeySchema,
      onRequest: checkAuthentication()
    },
    APIKeyController.updateAPIKey
  )

  server.delete(
    '/v2/my/api-keys/:api_key_id',
    {
      schema: APIKeyController.DeleteAPIKeySchema,
      onRequest: checkAuthentication()
    },
    APIKeyController.deleteAPIKey
  )

  // email subscriptions

  server.get(
    '/v2/my/email/subscriptions',
    {
      schema: SubscriptionController.ListEmailSubscriptionsSchema,
      onRequest: checkAuthentication()
    },
    SubscriptionController.listEmailSubscriptions
  )

  server.patch(
    '/v2/my/email/subscriptions',
    {
      schema: SubscriptionController.UpdateEmailSubscriptionsSchema,
      onRequest: checkAuthentication()
    },
    SubscriptionController.updateEmailSubscriptions
  )
}
