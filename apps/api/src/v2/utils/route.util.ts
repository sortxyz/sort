import * as Sentry from '@sentry/node'
import { NotFoundError } from '@sort/shared/errors/not-found.error'
import {
  GeneralErrorSchema,
  ValidationErrorSchema
} from '@sort/shared/schemas/api.schema'
import * as APIKeyService from '@sort/shared/services/apikey.service'
import * as UserService from '@sort/shared/services/user.service'

import { config, logger } from '../../config/bootstrap'
const { SORTUI_SERVICE_ACCOUNT_EMAIL, IS_PROD_ENV } = config
import {
  HEADER_API_KEY,
  HEADER_AUTHORIZATION
} from '../../global/constants/header.constant'
import { toServerErrorMessage } from '../../global/utils/error.util'

import { SortHubJwt, auth0JwtVerify } from './jwt.util'
import { convertValidationErrors } from './route-validation.util'

import type {
  RequestSection,
  SortValidationResult
} from './route-validation.util'
import type {
  FastifyReplyTypebox,
  FastifyRequestTypebox
} from '../types/fastify.type'
import type { TSchema } from '@sinclair/typebox'
import type { GeneralError } from '@sort/shared/schemas/api.schema'
import type { SortDB } from '@sort/shared/types/kysely.type'
import type { FastifyInstance, FastifyError, FastifySchema } from 'fastify'
import type { Selectable } from 'kysely'

export const checkAuthenticationSchema = {
  response: {
    401: GeneralErrorSchema
  }
} satisfies FastifySchema

export type authRestriction =
  | 'isCustomerAccount'
  | 'isPublicAccount'
  | 'isAccount'

/**
 * Generates and returns API authentication middleware.
 *
 * This middleware will check for the presence of an API key or Sort JWT in the
 * headers of the request. If the API key is present, it will be used to lookup
 * the user in the database. If the Sort JWT is present, it will be verified and
 * the user will be looked up in the database.
 * @param restriction - The restriction to apply to the user. The default is 'isCustomerAccount'.
 * @example
 *  'isCustomerAccount' - The user must be a customer.
 *  'isPublicAccount' - The user must be the SortHub service account.
 *  'isAccount' - Either a customer or the SortHub service account.
 */
export const checkAuthentication =
  (restriction: authRestriction = 'isCustomerAccount') =>
  async (
    request: FastifyRequestTypebox<typeof checkAuthenticationSchema>,
    reply: FastifyReplyTypebox<typeof checkAuthenticationSchema>
  ) => {
    const defaultFailure = {
      type: 'error',
      payload: {
        error: { message: 'Not Authorized.' }
      }
    } satisfies GeneralError

    let user: Selectable<SortDB['user']> | undefined

    try {
      if (
        !request.headers ||
        (!request.headers[HEADER_AUTHORIZATION] &&
          !request.headers[HEADER_API_KEY])
      ) {
        return reply.status(401).send(defaultFailure)
      }

      if (request.headers[HEADER_AUTHORIZATION]) {
        const sortJWT = getAuthorizationBearer(
          request.headers[HEADER_AUTHORIZATION]
        )

        if (sortJWT.length === 0) {
          request.log.info('Authorization bearer is empty')
          return reply.status(401).send(defaultFailure)
        }

        const verifiedJWT = await SortHubJwt.verify(sortJWT)

        if (!verifiedJWT.user?.id) {
          request.log.info({ verifiedJWT }, 'Missing Sort JWT user id')
          return reply.status(401).send(defaultFailure)
        }

        if (!verifiedJWT.iat) {
          request.log.info({ verifiedJWT }, 'Missing Sort JWT iat')
          return reply.status(401).send(defaultFailure)
        }

        user = await UserService.getUserById(verifiedJWT.user.id)
        if (!user) {
          request.log.info({ verifiedJWT }, 'User does not exist')
          return reply.status(401).send(defaultFailure)
        }

        // Any JWT issued before the password change is expired.
        if (user.password_reset_at) {
          const issuedDate = new Date(verifiedJWT.iat * 1000)
          if (issuedDate < user.password_reset_at) {
            request.log.info(
              { verifiedJWT },
              'Sort JWT is expired. Password changed.'
            )
            return reply.status(401).send(defaultFailure)
          }
        }
      } else {
        const apiKey = request.headers[HEADER_API_KEY] as string
        user = await APIKeyService.getUserByAPIKey({ apiKey })
        if (!user) {
          request.log.info('User does not exist')
          return reply.status(401).send(defaultFailure)
        }
      }

      const isCustomerAccount = user.email !== SORTUI_SERVICE_ACCOUNT_EMAIL
      const isPublicAccount = !isCustomerAccount

      if (restriction === 'isPublicAccount' && !isPublicAccount) {
        request.log.info('Non-public account')
        return reply.status(401).send(defaultFailure)
      }

      if (restriction === 'isCustomerAccount' && !isCustomerAccount) {
        request.log.info('Non-customer account')
        return reply.status(401).send(defaultFailure)
      }

      request.sort = Object.freeze({
        user,
        isCustomerAccount,
        isPublicAccount
      })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'FAST_JWT_EXPIRED') {
        request.log.error(error)
      }
      return reply.status(401).send(defaultFailure)
    }
  }

export const serverErrorHandlerSchema = {
  response: {
    400: ValidationErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const serverErrorHandler = (
  error: FastifyError & { serialization?: unknown },
  request: FastifyRequestTypebox<typeof serverErrorHandlerSchema>,
  reply: FastifyReplyTypebox<typeof serverErrorHandlerSchema>
) => {
  if (error instanceof NotFoundError) {
    return reply.sendNotFound(error.entity)
  }

  const { validation, validationContext } = error

  if (validation && validationContext !== undefined) {
    const section: RequestSection =
      validationContext === 'querystring' ? 'query' : validationContext

    const data = request[section] as { [key: string]: unknown }

    const formattedErrors = convertValidationErrors(
      section,
      data,
      validation as SortValidationResult[]
    )

    const payload = {
      validation_error: {
        context: validationContext,
        message: `A validation error occurred when validating the ${validationContext}.`,
        errors: formattedErrors
      }
    }

    request.log.debug(
      { section, data, validation, payload },
      'Validation error occurred'
    )

    return reply.status(400).send({
      type: 'validation_error',
      payload
    })
  }

  const statusCode = error.statusCode ?? 500

  const message =
    statusCode < 500 && error.message
      ? error.message
      : toServerErrorMessage(request.id)

  if (statusCode < 500) {
    request.log.info(error)
  } else {
    if (error.name === 'TypeError' && error.serialization && reply.rawPayload) {
      request.log.info(reply.rawPayload, 'serialization data')
    }
    request.log.error(error)

    if (IS_PROD_ENV) {
      Sentry.captureException(error, {
        tags: {
          reqId: request.id,
          url: request.url.substring(0, 200), // sentry max value length
          processId: process.pid
        }
      })
    }
  }

  if (
    error.name === 'SyntaxError' &&
    statusCode === 400 &&
    /JSON/.test(message)
  ) {
    // for example: invalid incoming JSON
    return reply.status(statusCode).send({
      type: 'validation_error',
      payload: {
        validation_error: {
          message: 'A validation error occurred when parsing the JSON body.',
          context: 'body',
          errors: {
            body: {
              syntax: message
            }
          }
        }
      }
    })
  }

  if (error.name === 'FastifyError' && statusCode === 400) {
    // https://fastify.dev/docs/latest/Reference/Errors/
    // for example: FST_ERR_CTP_EMPTY_JSON_BODY
    // To reproduce: send a request to an endpoint with no json body and the
    // "content-type" header set to "application/json"
    return reply.status(statusCode).send({
      type: 'validation_error',
      payload: {
        validation_error: {
          message: 'A validation error occurred.',
          context: 'body',
          errors: {
            body: {
              message
            }
          }
        }
      }
    })
  }

  return reply.status(statusCode).send({
    type: 'error',
    payload: {
      error: {
        message
      }
    }
  })
}

export const notFoundHandlerSchema = {
  response: {
    404: GeneralErrorSchema
  }
} satisfies FastifySchema

export const notFoundHandler = (
  request: FastifyRequestTypebox<typeof notFoundHandlerSchema>,
  reply: FastifyReplyTypebox<typeof notFoundHandlerSchema>
): void => {
  const { url, method } = request.raw
  const message = `Route ${method}:${url} not found.`

  request.log.info(message)

  void reply.status(404).send({
    type: 'error',
    payload: {
      error: {
        message
      }
    }
  })
}

/**
 * Extracts the bearer token from the given `authorization` header.
 */
export const getAuthorizationBearer = (authorization: string) => {
  const parts = authorization.split(' ')
  const token = parts[1] ?? ''
  return token.trim()
}

const validateAuth0JWTSchema = {
  response: {
    404: GeneralErrorSchema
  }
} satisfies FastifySchema

export const validateAuth0JWT = async (
  request: FastifyRequestTypebox<typeof validateAuth0JWTSchema>,
  reply: FastifyReplyTypebox<typeof validateAuth0JWTSchema>
) => {
  const default404 = {
    type: 'error',
    payload: {
      error: {
        message: `Route ${request.method}:${request.routeOptions.url} not found`
      }
    }
  } satisfies GeneralError

  try {
    if (!request.headers) {
      request.log.info('Missing request headers')
      return reply.status(404).send(default404)
    }

    const auth0JWT = getAuthorizationBearer(
      request.headers[HEADER_AUTHORIZATION] ?? ''
    )

    if (auth0JWT.length === 0) {
      request.log.info('Invalid authorization bearer header')
      return reply.status(404).send(default404)
    }

    const verifiedAuth0JWT = await auth0JwtVerify(auth0JWT)

    if (!verifiedAuth0JWT?.sub) {
      request.log.info({ verifiedAuth0JWT }, 'Missing Auth0 JWT sub (user id)')
      return reply.status(404).send(default404)
    }

    request.auth0 = verifiedAuth0JWT
  } catch (error) {
    request.log.error(error)
    return reply.status(404).send(default404)
  }
}

/** Adds the given TypeBox schema to our OpenAPI spec */
export const addSchema = (server: FastifyInstance, schema: TSchema) => {
  try {
    const id = String(schema.$id)
    logger.debug(`Adding schema "${id}" ..`)
    if (server.getSchema(id)) {
      logger.debug(`✗ Schema "${id}" already exists. Skipping.`)
      return
    }
    server.addSchema(schema)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.dir(schema, { depth: null })
    throw error
  }
}

/**
 * Adds all schemas from the given controller to our OpenAPI spec.
 *
 * See https://swagger.io/specification/#components-object
 * */
export const addSchemas = (
  server: FastifyInstance,
  controllers: {
    [key: string]: unknown
    schemas?: TSchema[]
  }[]
) => {
  for (const controller of controllers) {
    if ('schemas' in controller && Array.isArray(controller.schemas)) {
      controller.schemas.forEach(schema => addSchema(server, schema))
    }
  }
}
