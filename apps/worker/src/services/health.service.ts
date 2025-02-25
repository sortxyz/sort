import { getDb } from '@sort/shared'
import { default as Fastify, errorCodes } from 'fastify'
import { sql } from 'kysely'

import { config, logger } from '../config/bootstrap'

import type {
  FastifyRequest,
  FastifyReply,
  RouteHandlerMethod,
  FastifyInstance
} from 'fastify'
import type { AddressInfo } from 'net'

let fastify: FastifyInstance

export const checkDatabase = async () => {
  const query = sql`SELECT pid FROM ${sql.raw(
    'pg_stat_activity'
  )} WHERE "state"='active' ORDER BY backend_start desc LIMIT 1`

  const result = await sql<{ pid: number }>`${query}`.execute(getDb())

  return result
}

export const healthServiceEndpoint = (
  healthSvcFn: healthServiceCheckFunction
): RouteHandlerMethod =>
  async function healthServiceRequestHandler(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      // empty is assumed to be a valid health check
      const healthChkResult = await healthSvcFn()
      if (healthChkResult)
        return reply.status(503).send({ code: 503, message: healthChkResult })

      await checkDatabase()

      return reply.status(204).send()
    } catch (error) {
      request.log.error(error)
      return reply.status(503).send({
        code: 503,
        message: `API dependencies aren't working properly. Request id: ${request.id}`
      })
    }
  }

export const closeFastify = async () => {
  if (!fastify) return

  await fastify.close()

  logger.info('Fastify successfully closed!')
}

export type healthServiceCheckFunction = () => Promise<string>

export const healthService = async (
  healthSvcChk: healthServiceCheckFunction
) => {
  if (fastify) return

  fastify = Fastify({
    logger: true
  })

  fastify.setErrorHandler(async (error, request, reply) => {
    if (error instanceof errorCodes.FST_ERR_BAD_STATUS_CODE) {
      request.log.error(error, 'Fastify specific error occurred')
      reply.status(500).send({ ok: false })
    } else {
      request.log.error(error, 'An error occurred handling a route in fastify')
      // fastify will use parent error handler to handle this
      reply.send(error)
    }
  })

  fastify.get('/', healthServiceEndpoint(healthSvcChk))

  await fastify.listen({
    host: config.HEALTH_SERVICE_HOST,
    port: config.HEALTH_SERVICE_PORT
  })

  const info = fastify.server.address() as AddressInfo

  logger.info(
    `Health service is now listening on ${info?.address}:${info?.port} using ${
      process.env.NODE_ENV ?? 'development'
    } NODE_ENV`
  )
}
