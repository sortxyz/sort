import type { SortLogger } from '@sort/logger'

type ShutdownLogger = Pick<SortLogger, 'info' | 'error' | 'debug'>

const shutdownOn = ({
  signal,
  logger,
  cleanup
}: {
  signal: NodeJS.Signals
  logger: ShutdownLogger
  cleanup: () => Promise<void>
}) => {
  process.once(signal, async () => {
    await shutdownGracefully({ source: signal, signal, cleanup, logger })
  })
}

export const shutdownGracefully = async ({
  source,
  signal,
  cleanup,
  logger
}: {
  source: string
  signal?: NodeJS.Signals
  logger: ShutdownLogger
  cleanup: () => Promise<void>
}) => {
  logger.info(`Shutting down gracefully from '${source}'`)

  try {
    await cleanup()
  } catch (error) {
    logger.error(error, 'Error closing gracefully')
  }

  const sig = signal ?? 'SIGINT'
  logger.info(
    `Killing process (self) PID: ${process.pid} with signal '${sig}'..`
  )

  // give a little extra time for logs to flush
  await new Promise(resolve => setTimeout(resolve, 500))

  process.kill(process.pid, sig)
}

export const registerShutdown = ({
  logger,
  cleanup
}: {
  logger: ShutdownLogger
  cleanup: () => Promise<void>
}) => {
  process.removeAllListeners('SIGINT')
  process.removeAllListeners('SIGTERM')
  shutdownOn({ signal: 'SIGINT', logger, cleanup })
  shutdownOn({ signal: 'SIGTERM', logger, cleanup })

  process.on('uncaughtException', async function (error) {
    logger.error(error, 'Uncaught exception')
    await shutdownGracefully({ source: 'uncaughtException', logger, cleanup })
  })

  process.on('unhandledRejection', async function (error) {
    logger.error(error, 'Unhandled rejection')
    await shutdownGracefully({ source: 'unhandledRejection', logger, cleanup })
  })
}
