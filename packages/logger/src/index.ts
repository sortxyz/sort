import process from 'node:process'

import * as Sentry from '@sentry/node'
import pino from 'pino'

export type SortLogger = Pick<pino.Logger, 'info' | 'error' | 'debug' | 'child'>

/**
 * Creates a pino Logger instance with the specified log level and app version. To
 * include request or job id in logs, create a child logger with the desired
 * bindings.
 *
 * @example
 * const logger = createLogger({ LOG_LEVEL: 'info', APP_VERSION: '1.0.0' })
 * workerLogger = logger.child({ jobId: 'some-job-123' })
 * workerLogger.info('Processing job...')
 */
export const createLogger = ({
  LOG_LEVEL,
  APP_VERSION
}: {
  LOG_LEVEL: string
  APP_VERSION: string
}): SortLogger => {
  const logger = pino({ level: LOG_LEVEL })
  logger.setBindings({ processId: process.pid, version: APP_VERSION })
  return logger satisfies SortLogger
}

/** Sends errors to Sentry */
export const notifySentry = ({
  error,
  message,
  contextId
}: {
  error: unknown
  message: string
  contextId?: string
}) => {
  Sentry.captureException(error, {
    extra: { message },
    tags: { contextId, processId: process.pid }
  })
}
