import { notifySentry } from '@sort/logger'
import { registerShutdown } from '@sort/shutdown'
import { sql } from 'kysely'

import { logger, config } from './config/bootstrap'
import {
  createKysely,
  getDb,
  disconnectKysely
} from './global/services/kysely.service'
import { createServer } from './global/utils/server.util'

process.title = 'sort-api'

const { ENV, SERVICE_PORT, SERVICE_HOST } = config

const runServer = async () => {
  createKysely()

  const server = await createServer()

  server.listen(
    { host: SERVICE_HOST, port: SERVICE_PORT },
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    async (error, address) => {
      if (error) {
        logger.error(error, 'Failed to start the service')
        notifySentry({ error, message: 'Failed to start the service' })
        return
      }

      // ensure db connection
      await sql`select now()`.execute(getDb())

      logger.info(
        `Service is now listening on ${address} using ${ENV} NODE_ENV`
      )
    }
  )

  registerShutdown({
    logger,
    cleanup: async () => {
      await server.close()
      await disconnectKysely()
    }
  })
}

void runServer()
