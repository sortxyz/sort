import { Type } from '@sinclair/typebox'

import { GeneralError, GeneralSuccess } from '../types/api.type'

import type { FastifyInstance } from 'fastify'

const text = `
User-agent: *
Disallow: /
Allow: /docs/*
`.trim()

export const registerGetRobots = (server: FastifyInstance) => {
  server.get(
    '/robots.txt',
    {
      schema: {
        hide: true,
        response: {
          200: GeneralSuccess(Type.String()),
          500: GeneralError
        }
      }
    },
    (_, reply) => {
      return reply.send(text)
    }
  )
}
