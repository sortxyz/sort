import { getDb } from '../services/kysely.service'
import { toServerErrorMessage } from '../utils/error.util'

import type { FastifyReply, FastifyRequest } from 'fastify'

const checkDb = async (): Promise<void> => {
  try {
    await getDb().selectFrom('role').selectAll().limit(1).execute()
  } catch (error) {
    const err = error as Error
    err.message = `Error checking base db connection: ${err.message}`
    throw err
  }
}

export const check = async (
  request: Pick<FastifyRequest, 'log' | 'id'>,
  reply: Pick<FastifyReply, 'send' | 'status'>
) => {
  request.log.info('Checking dependency health..')

  try {
    await checkDb()
    return reply.status(204).send()
  } catch (error) {
    request.log.error(error)

    return reply.status(503).send({
      code: 503,
      message: toServerErrorMessage(
        request.id,
        "API dependencies aren't working properly."
      )
    })
  }
}
