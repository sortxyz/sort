import { Type } from '@sinclair/typebox'

import * as HealthController from '../controllers/health.controller'
import { GeneralError } from '../types/api.type'

import type { FastifyInstance } from 'fastify'

export const registerGetHealth = (server: FastifyInstance) => {
  server.get(
    '/health',
    {
      schema: {
        hide: true,
        response: {
          204: Type.String(),
          503: GeneralError
        }
      }
    },
    HealthController.check
  )
}
