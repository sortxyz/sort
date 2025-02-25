import { createHash, randomUUID } from 'node:crypto'

import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import ScalarUI from '@scalar/fastify-api-reference'
import Fastify from 'fastify'

import { config } from '../../config/bootstrap'
import { descriptions } from '../../docs/descriptions'
import * as v2Routes from '../../v2/routes/index'
import { HEADER_API_KEY } from '../constants/header.constant'
import * as globalRoutes from '../routes/index'

import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import type { NotFoundEntity } from '@sort/shared/errors/not-found.error'
import type { SortContext } from '@sort/shared/types/sort-context.type'
import type { FastifyReply, FastifyRequest } from 'fastify'

const {
  SERVICE_URL,
  IS_TEST_ENV,
  APP_VERSION,
  SERVICE_RATE_LIMIT_MAX,
  SERVICE_RATE_LIMIT_TIME_WINDOW
} = config

declare module 'fastify' {
  interface FastifyRequest {
    sort: SortContext
  }
  interface FastifyReply {
    sendNotFound: (entity: NotFoundEntity) => FastifyReply
    sendForbidden: () => FastifyReply
    rawPayload: unknown
  }
}

export const onSendHook = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  void reply.header('request-id', request.id)
}

export const createServer = async () => {
  const server = Fastify({
    ajv: {
      customOptions: {
        discriminator: true,
        removeAdditional: false
      }
    },
    trustProxy: config.IS_PROD_ENV,
    genReqId: () => randomUUID(),
    logger:
      IS_TEST_ENV && config.LOG_LEVEL !== 'debug'
        ? false
        : {
            level: config.LOG_LEVEL,
            serializers: {
              req(request) {
                const ips =
                  request.headers['x-sort-forwarded-for'] ?? request.ip

                return {
                  method: request.method,
                  url: request.url,
                  hostname: request.hostname,
                  remoteAddress: String(ips),
                  remotePort: request.socket
                    ? request.socket.remotePort
                    : undefined
                }
              },
              res(reply) {
                // include unique user identifier in logs without leaking sensitive data
                const jwt = reply.request?.headers.authorization as string
                const apiKey = reply.request?.headers[HEADER_API_KEY] as string
                const token = jwt ?? apiKey
                const user = token
                  ? createHash('sha1').update(token).digest('base64')
                  : 'anonymous'
                const authType = jwt ? 'jwt' : apiKey ? 'api_key' : 'none'
                const ips =
                  reply.request?.headers['x-sort-forwarded-for'] ??
                  reply.request?.ip

                return {
                  method: reply.request?.method,
                  url: reply.request?.url,
                  statusCode: reply.statusCode,
                  remoteAddress: String(ips),
                  remotePort: reply.request?.socket
                    ? reply.request.socket.remotePort
                    : undefined,
                  user,
                  authType
                }
              }
            }
          }
  }).withTypeProvider<TypeBoxTypeProvider>()

  server.addHook('onSend', onSendHook)

  server.addHook('preSerialization', async (request, reply, payload) => {
    reply.rawPayload = payload
    return payload
  })

  server.decorateRequest('sort', null)

  server.decorateReply(
    'sendNotFound',
    function (this: FastifyReply, entity: string) {
      const message = `${
        entity.charAt(0).toUpperCase() + entity.slice(1)
      } not found.`
      return this.status(404).send({
        type: 'error',
        payload: {
          error: { message }
        }
      })
    }
  )

  server.decorateReply('sendForbidden', function (this: FastifyReply) {
    return this.status(403).send({
      type: 'error',
      payload: {
        error: { message: 'Forbidden.' }
      }
    })
  })

  await server.register(cors)

  if (!IS_TEST_ENV) {
    // FIXME: support > 1 running server: https://github.com/sortxyz/sort-api-v2/issues/234
    await server.register(rateLimit, {
      keyGenerator: (request: FastifyRequest) =>
        request.headers[HEADER_API_KEY]?.toString() || request.ip,
      max: SERVICE_RATE_LIMIT_MAX,
      timeWindow: SERVICE_RATE_LIMIT_TIME_WINDOW
    })
  }

  await server.register(swagger, {
    mode: 'dynamic',
    openapi: {
      openapi: '3.1.0',
      servers: [{ url: SERVICE_URL }],
      info: {
        title: 'Sort API',
        version: APP_VERSION,
        description: descriptions.get('welcome')
      },
      externalDocs: {
        url: 'https://api.sort.xyz/docs',
        description: 'The sort.xyz API documentation'
      },
      security: [{ apiKey: [] }],
      components: {
        securitySchemes: {
          apiKey: {
            type: 'apiKey',
            name: HEADER_API_KEY,
            in: 'header',
            description:
              'An API key is required to access the API. https://docs.sort.xyz/docs/accounts/api-keys'
          }
        }
      },
      tags: [
        { name: 'api_key', description: 'Sort API Key management' },
        {
          name: 'change_request',
          description: 'Everything you need to manage Change Requests'
        },
        {
          name: 'connection',
          description: 'Manage your Organization connections'
        },
        {
          name: 'database',
          description: 'Manage your Sort Databases and access their schemas'
        },
        {
          name: 'email',
          description: 'Manage your email subscriptions and preferences'
        },
        {
          name: 'invite',
          description: 'Mange your Sort Organization Invites'
        },
        { name: 'issue', description: 'Create and manage database Issues' },
        {
          name: 'label',
          description: 'Create and customize your database Labels'
        },
        {
          name: 'organization',
          description: 'Create and customize your Sort Organizations'
        },
        { name: 'profile', description: 'Manage your Sort user profile' },
        {
          name: 'query',
          description:
            'Create, run and manage the queries of your Sort databases'
        },
        {
          name: 'relation',
          description: 'Associate Change Requests to Issues'
        },
        {
          name: 'search',
          description:
            'Search Sort for Issues, Change Requests, databases and more'
        }
      ]
    },
    transform({ schema, url }) {
      if (!schema.description && descriptions.has(schema.operationId)) {
        schema.description = descriptions.get(schema.operationId)
      }

      return { schema, url }
    }
  })

  await server.register(ScalarUI, {
    routePrefix: '/docs',
    openApiDocumentEndpoints: { json: '/json', yaml: '/yaml' },
    configuration: {
      favicon: 'https:/sort.xyz/favicon.ico',
      metaData: {
        title: 'Sort API Reference'
      }
    }
  })

  globalRoutes.register(server)
  v2Routes.register(server)

  await server.ready()

  return server
}
