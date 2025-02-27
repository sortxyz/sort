import { createHash } from 'node:crypto'

import { Type } from '@sinclair/typebox'
import * as Errors from '@sort/shared/errors/index'
import {
  AuthHeadersSchema,
  GeneralErrorSchema,
  GeneralSuccessSchema,
  ValidationErrorSchema,
  createMessageSchema
} from '@sort/shared/schemas/api.schema'
import { ProfileSchema } from '@sort/shared/schemas/user.schema'
import {
  sendWelcomeEmail,
  sendVerificationEmail
} from '@sort/shared/services/notification.service'
import * as UserService from '@sort/shared/services/user.service'
import * as Utils from '@sort/shared/utils/index'
import { generateUsername } from 'friendly-username-generator'

import { config } from '../../../config/bootstrap'
import { HEADER_AUTHORIZATION } from '../../../global/constants/header.constant'
import { getDb } from '../../../global/services/kysely.service'
import { isFeatureEnabled } from '../../../global/utils/feature-flag.util'
import {
  SortWebJwt,
  EmailVerificationJwt,
  SortWebOnPremJwt
} from '../../utils/jwt.util'
import { getAuthorizationBearer } from '../../utils/route.util'

import type {
  FastifyReplyTypebox,
  FastifyRequestTypebox
} from '../../types/fastify.type'
import type { Auth0JWT } from '../../types/jwt.type'
import type { GeneralError } from '@sort/shared/schemas/api.schema'
import type { FastifySchema } from 'fastify'

export const initializeUserSchema = {
  headers: AuthHeadersSchema,
  operationId: 'initialize_user',
  response: {
    200: createMessageSchema(
      'initialize_user',
      Type.Object({
        jwt: Type.String({ format: 'jwt' }),
        profile: ProfileSchema
      })
    ),
    400: ValidationErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  },
  hide: true // hide the endpoint from openapi docs
} satisfies FastifySchema

const gravatarUrl = ({
  email,
  fallbackUrl
}: {
  email: string
  fallbackUrl: string
}) => {
  const hash = createHash('md5')
    .update(email.trim().toLowerCase())
    .digest('hex')

  const fallback = encodeURIComponent(fallbackUrl)

  return `https://gravatar.com/avatar/${hash}?s=48&d=${fallback}&r=pg`
}

const auth0ProfileUrl = (name: string) => {
  const trimmedName = name.trim()

  const candidateLetters = /\s/.test(trimmedName)
    ? trimmedName
        .split(' ')
        .filter(Boolean)
        .splice(0, 2)
        .map(word => word.charAt(0))
        .join('')
    : trimmedName.charAt(0)

  const letters = candidateLetters.toLowerCase()

  return `https://cdn.auth0.com/avatars/${letters}.png`
}

const standardizeProfilePicture = (
  user: Pick<Auth0JWT, 'name' | 'email' | 'picture'>
) => {
  if (typeof user.picture === 'string' && user.picture.length <= 180) {
    return user.picture
  }

  return gravatarUrl({
    email: user.email || '',
    fallbackUrl: auth0ProfileUrl(user.name || user.email || 'me')
  })
}

export const initializeUser = async (
  request: FastifyRequestTypebox<typeof initializeUserSchema>,
  reply: FastifyReplyTypebox<typeof initializeUserSchema>
) => {
  const userId = request.auth0.sub

  const tryCreateUser = async () => {
    const username = generateUsername()
    let name = request.auth0.name ?? null
    // avoid auth0 setting our username to our email so we don't leak emails to the public
    if (name === request.auth0.email) {
      name = username
    }
    return await UserService.createUser({
      id: userId,
      username,
      username_discord: null,
      name,
      email: request.auth0.email ?? null,
      email_verified: false,
      picture: standardizeProfilePicture(request.auth0)
    })
  }

  const shouldRetryUserFailure = (error: Error) => {
    if (!(error instanceof Errors.DatabaseUniquenessError)) {
      throw error
    }

    if (error.table !== 'user') {
      throw error
    }

    switch (error.column) {
      case 'id':
        request.log.info({ user_id: error.value }, 'User already exists.')
        return false
      case 'username':
        request.log.info({ username: error.value }, 'User already exists.')
        return true
      default:
        throw error
    }
  }

  let user = await Utils.retry(tryCreateUser, shouldRetryUserFailure, 3)
  const isSignUp = !!user

  if (!user) {
    user = await UserService.getUserById(userId)
    if (!user) {
      // Edge case: This could happen when the User was deleted from the
      // database between the time we tried inserting it and the time we tried
      // fetching it.
      throw new Error('User not found.', {
        cause: {
          user_id: userId
        }
      })
    }
  }

  await UserService.trackLogin(user)

  if (user.email) {
    if (isSignUp) {
      void sendWelcomeEmail({
        name: user.name === user.username ? user.email : user.name,
        email: user.email,
        logger: request.log
      })
    }

    if (isSignUp || !user.email_verified) {
      const key = EmailVerificationJwt.create({
        user: { id: user.id, email: user.email }
      })
      void sendVerificationEmail({
        email: user.email,
        name: user.name,
        key,
        logger: request.log
      })
    }
  }

  const jwt = SortWebJwt.create({ user: { id: userId } })
  return reply.status(200).send({
    type: 'initialize_user',
    payload: {
      jwt,
      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        email_verified: user.email_verified,
        picture: user.picture,
        username: user.username
      }
    }
  })
}

export const initializeOnPremUserSchema = {
  headers: AuthHeadersSchema,
  operationId: 'initialize_onprem_user',
  response: {
    200: createMessageSchema(
      'initialize_onprem_user',
      Type.Object({
        jwt: Type.String({ format: 'jwt' }),
        profile: ProfileSchema
      })
    ),
    400: ValidationErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  },
  hide: true // hide the endpoint from openapi docs
} satisfies FastifySchema

export const initializeOnPremUser = async (
  request: FastifyRequestTypebox<typeof initializeOnPremUserSchema>,
  reply: FastifyReplyTypebox<typeof initializeOnPremUserSchema>
) => {
  const default404 = {
    type: 'error',
    payload: {
      error: {
        message: `Route ${request.method}:${request.routeOptions.url} not found`
      }
    }
  } satisfies GeneralError

  if (!isFeatureEnabled('ON_PREM_AUTH')) {
    request.log.info('Not running onprem')
    return reply.status(404).send(default404)
  }

  let verifiedAuth
  try {
    if (!request.headers) {
      request.log.info('Missing request headers')
      return reply.status(404).send(default404)
    }

    const authJWT = getAuthorizationBearer(
      request.headers[HEADER_AUTHORIZATION] ?? ''
    )

    if (authJWT.length === 0) {
      request.log.info('Invalid authorization bearer header')
      return reply.status(404).send(default404)
    }

    verifiedAuth = await SortWebOnPremJwt.verify(authJWT)
    if (!verifiedAuth?.sub) {
      request.log.info({ verifiedAuth }, 'Missing Auth JWT sub (user id)')
      return reply.status(404).send(default404)
    }
  } catch (error) {
    request.log.error(error)
    return reply.status(404).send(default404)
  }

  const email = verifiedAuth.user.email.trim().toLowerCase()
  const emailHash = createHash('md5').update(email).digest('hex')
  const userId = `onprem|${emailHash}`

  const tryCreateUser = async () => {
    const username = generateUsername()
    return await UserService.createUser({
      id: userId,
      username,
      username_discord: null,
      name: username,
      email,
      email_verified: false,
      picture: standardizeProfilePicture(verifiedAuth.user)
    })
  }

  const shouldRetryUserFailure = (error: Error) => {
    if (!(error instanceof Errors.DatabaseUniquenessError)) {
      throw error
    }

    if (error.table !== 'user') {
      throw error
    }

    switch (error.column) {
      case 'id':
        request.log.info({ user_id: error.value }, 'User already exists.')
        return false
      case 'username':
        request.log.info({ username: error.value }, 'User already exists.')
        return true
      default:
        throw error
    }
  }

  let user = await Utils.retry(tryCreateUser, shouldRetryUserFailure, 3)
  if (!user) {
    user = await UserService.getUserById(userId)
    if (!user) {
      // Edge case: This could happen when the User was deleted from the
      // database between the time we tried inserting it and the time we tried
      // fetching it.
      throw new Error('User not found.', {
        cause: {
          user_id: userId
        }
      })
    }
  }

  await UserService.trackLogin(user)

  const jwt = SortWebJwt.create({ user: { id: userId } })
  return reply.status(200).send({
    type: 'initialize_onprem_user',
    payload: {
      jwt,
      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        email_verified: user.email_verified,
        picture: user.picture,
        username: user.username
      }
    }
  })
}

export const VerifyEmailBodySchema = {
  headers: AuthHeadersSchema,
  body: Type.Object({
    key: Type.String(),
    subscribe: Type.Boolean()
  }),
  hide: true,
  summary: 'Verify user email',
  operationId: 'verify_email',
  tags: [],
  response: {
    200: GeneralSuccessSchema,
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const verifyEmail = async (
  request: FastifyRequestTypebox<typeof VerifyEmailBodySchema>,
  reply: FastifyReplyTypebox<typeof VerifyEmailBodySchema>
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

  let jwt: Awaited<ReturnType<typeof EmailVerificationJwt.verify>>
  try {
    jwt = await EmailVerificationJwt.verify(request.body.key)
  } catch (error) {
    request.log.error(error, 'Invalid email JWT')

    const err = error as Error
    const message = /The token has expired/.test(err.message)
      ? 'This email link has expired.'
      : 'Invalid key.'

    return reply.status(400).send({
      type: 'validation_error',
      payload: {
        validation_error: {
          message,
          context: 'body',
          errors: {
            body: {
              key: message
            }
          }
        }
      }
    })
  }

  const userId = request.sort.user.id
  const isValidKey =
    jwt.user.id === userId && jwt.user.email === request.sort.user.email

  if (!isValidKey) {
    request.log.error('Invalid email JWT: does not match authenticated user')
    return reply.status(400).send({
      type: 'validation_error',
      payload: {
        validation_error: {
          message:
            'This key does not match your email address. Are you logged in with the correct account?',
          context: 'body',
          errors: {
            body: {
              key: 'This key does not match your email address. Are you logged in with the correct account?'
            }
          }
        }
      }
    })
  }

  if (request.sort.user.email_verified) {
    request.log.info('Email already verified.')
    return reply.status(400).send({
      type: 'validation_error',
      payload: {
        validation_error: {
          message: 'Email already verified.',
          context: 'body',
          errors: {
            body: {
              key: 'Email already verified.'
            }
          }
        }
      }
    })
  }

  if (request.body.subscribe) {
    const result = await UserService.addToCustomerMailingList(request.sort.user)
    if (result.added) {
      request.log.info('Added to newsletter list')
    } else {
      request.log.info('Already on newsletter list')
    }
  } else {
    // By law we must honor their unsubscribe request (CANSPAM Act). If the mailgun
    // request fails, we must fail the entire request so they can try again.
    await UserService.removeFromCustomerMailingList(request.sort.user)
    request.log.info('Removed from newsletter list')
  }

  await getDb()
    .updateTable('user')
    .where('id', '=', userId)
    .set({ email_verified: true })
    .execute()

  return reply.status(200).send({
    type: 'success',
    payload: {
      success: {
        message: 'You have successfully verified your email address.'
      }
    }
  })
}

export const revokeSessionsSchema = {
  body: Type.Object({ user_id: Type.String(), secret: Type.String() }),
  operationId: 'revoke_sessions',
  response: {
    200: GeneralSuccessSchema,
    400: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  },
  hide: true // hide the endpoint from openapi docs
} satisfies FastifySchema

export const revokeSessions = async (
  request: FastifyRequestTypebox<typeof revokeSessionsSchema>,
  reply: FastifyReplyTypebox<typeof revokeSessionsSchema>
) => {
  if (request.body.secret !== config.SORT_SESSION_REVOKE_SECRET) {
    return reply.status(400).send({
      type: 'error',
      payload: {
        error: {
          message: 'Invalid secret'
        }
      }
    })
  }

  const result = await getDb()
    .updateTable('user')
    .where('id', '=', request.body.user_id.trim())
    .set({ password_reset_at: new Date() })
    .returning('id')
    .executeTakeFirst()

  if (!result) {
    return reply.sendNotFound('user')
  }

  return reply.status(200).send({
    type: 'success',
    payload: {
      success: {
        message: 'Sessions revoked'
      }
    }
  })
}
