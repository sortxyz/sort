import { createKysely, disconnectKysely } from '@sort/shared'
import { registerShutdown } from '@sort/shutdown'

import { config, logger } from './config/bootstrap'
import { closeFastify, healthService } from './services/health.service'

import type { healthServiceCheckFunction } from './services/health.service'

/**
 * Base class for all workers
 */
export abstract class WorkerBase {
  constructor(
    private healthSvcChk: healthServiceCheckFunction = () => Promise.resolve('')
  ) {}

  async prestartWorker() {
    logger.info('Running worker pre-start...')

    createKysely({
      sortLogger: logger,
      config
    })

    await healthService(this.healthSvcChk)

    registerShutdown({
      logger,
      cleanup: () => this.stop()
    })
  }

  async stop() {
    await closeFastify()
    await disconnectKysely()
  }

  async runWorker(): Promise<void> {
    throw new Error('Not implemented')
  }

  async start(): Promise<void> {
    await this.prestartWorker()

    logger.info('Starting worker...')

    await this.runWorker()
  }
}
