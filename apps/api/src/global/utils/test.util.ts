import { createServer } from './server.util'

import type { FastifyInstance } from 'fastify'

let server: FastifyInstance | null = null

export const getTestServer = async () => {
  if (server) return server
  server = await createServer()
  return server
}

export const closeTestServer = async () => {
  if (!server) return
  await server.close()
  server = null
}
