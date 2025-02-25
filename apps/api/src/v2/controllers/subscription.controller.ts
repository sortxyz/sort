// manage mailing list subscriptions for marketing purposes

import { Type } from '@sinclair/typebox'
import {
  AuthHeadersSchema,
  GeneralErrorSchema,
  ValidationErrorSchema,
  createMessageSchema
} from '@sort/shared/schemas/api.schema'
import { SubscriptionSchema } from '@sort/shared/schemas/subscription.schema'
import * as UserService from '@sort/shared/services/user.service'

import { config } from '../../config/bootstrap'

import type {
  FastifyReplyTypebox,
  FastifyRequestTypebox
} from '../types/fastify.type'
import type { FastifySchema } from 'fastify'

export const schemas = [SubscriptionSchema]

export const ListEmailSubscriptionsSchema = {
  headers: AuthHeadersSchema,
  operationId: 'list_email_subscriptions',
  tags: ['email'],
  summary: 'List your email subscriptions',
  response: {
    200: createMessageSchema(
      'list_email_subscriptions',
      Type.Object({
        subscriptions: Type.Array(
          Type.Ref<typeof SubscriptionSchema>(SubscriptionSchema)
        )
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const listEmailSubscriptions = async (
  request: FastifyRequestTypebox<typeof ListEmailSubscriptionsSchema>,
  reply: FastifyReplyTypebox<typeof ListEmailSubscriptionsSchema>
) => {
  if (
    !(
      config.MAILGUN_API_KEY &&
      config.MAILGUN_DOMAIN &&
      config.MAILGUN_ALL_CUSTOMERS_LIST
    )
  ) {
    request.log.info('Email is disabled')
    return reply.status(200).send({
      type: 'list_email_subscriptions',
      payload: {
        subscriptions: []
      }
    })
  }

  const user = request.sort.user
  const subscriptions = await UserService.getMailingListSubscriptions(user)
  return reply.status(200).send({
    type: 'list_email_subscriptions',
    payload: {
      subscriptions
    }
  })
}

export const UpdateEmailSubscriptionsSchema = {
  headers: AuthHeadersSchema,
  operationId: 'update_email_subscriptions',
  tags: ['email'],
  body: Type.Object({
    subscriptions: Type.Array(SubscriptionSchema, { minItems: 1 })
  }),
  summary: 'Update your email subscriptions',
  response: {
    200: createMessageSchema(
      'update_email_subscriptions',
      Type.Object({
        subscriptions: Type.Array(
          Type.Ref<typeof SubscriptionSchema>(SubscriptionSchema)
        )
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    404: GeneralErrorSchema,
    409: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const updateEmailSubscriptions = async (
  request: FastifyRequestTypebox<typeof UpdateEmailSubscriptionsSchema>,
  reply: FastifyReplyTypebox<typeof UpdateEmailSubscriptionsSchema>
) => {
  if (
    !(
      config.MAILGUN_API_KEY &&
      config.MAILGUN_DOMAIN &&
      config.MAILGUN_ALL_CUSTOMERS_LIST
    )
  ) {
    request.log.info('Email is disabled')
    return reply.status(404).send({
      type: 'error',
      payload: {
        error: { message: 'Email is disabled' }
      }
    })
  }

  const user = request.sort.user

  if (!user.email) {
    return reply.status(409).send({
      type: 'error',
      payload: {
        error: {
          message: 'User must have an email address before subscribing.'
        }
      }
    })
  }

  if (!user.email_verified) {
    return reply.status(409).send({
      type: 'error',
      payload: {
        error: {
          message: 'Email address must be verified before subscribing.'
        }
      }
    })
  }

  const sub = request.body.subscriptions.find(s => s.name === 'newsletter')
  if (!sub) {
    // will never happen b/c input validation checks this
    throw new Error('Missing newsletter subscription')
  }

  if (sub.subscribed) {
    const result = await UserService.addToCustomerMailingList(user)
    if (result.added) {
      request.log.info('Added to newsletter list')
    } else {
      request.log.info('Already on newsletter list')
    }
  } else {
    // By law we must honor their unsubscribe request (CANSPAM Act). If the mailgun
    // request fails, we must fail the entire request so they can try again.
    await UserService.removeFromCustomerMailingList(user)
    request.log.info('Removed from newsletter list')
  }

  const subscriptions = await UserService.getMailingListSubscriptions(user)
  return reply.status(200).send({
    type: 'update_email_subscriptions',
    payload: {
      subscriptions
    }
  })
}
