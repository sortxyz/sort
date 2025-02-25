import { registerGetHealth } from './health.route'
import { registerGetRobots } from './robots.route'

import type { FastifyInstance } from 'fastify'

export const register = (server: FastifyInstance) => {
  registerGetHealth(server)
  registerGetRobots(server)
}
