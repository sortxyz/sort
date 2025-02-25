import { notifySentry } from '@sort/logger'
import * as ImportJobService from '@sort/shared/services/schema-import/job.service'
import { sendAnalyticsSlackNotification } from '@sort/shared/services/slack.service'
import { CronJob } from 'cron'

import { logger, config } from './config/bootstrap'
import { every5seconds, every5minutes } from './config/cron'
import { SchemaImportJobController } from './controller/schema-import-job.controller'
import { WorkerBase } from './worker.base'

let lastLogTime = 0
const logIfNoRecentJobs = (jobCount = 0) => {
  const now = Date.now()
  if (jobCount > 0) {
    lastLogTime = now
    return
  }

  if (now - lastLogTime > 60_000) {
    logger.info('Zero connection import jobs found in past minute')
    lastLogTime = now
  }
}

const startSchemaImportCron = (onComplete: () => void) => {
  const cadence = every5seconds
  const cron = CronJob.from({
    cronTime: cadence,
    onTick: async () => {
      const pendingJobs = await ImportJobService.getPendingJobs(10)
      logIfNoRecentJobs(pendingJobs.length)
      if (!pendingJobs.length) {
        return
      }

      await Promise.allSettled(
        pendingJobs.map(async job => {
          logger.info({ job_id: job.id }, '[schema import job]: start')
          const ctrl = new SchemaImportJobController(job)
          await ctrl.runJob()
          logger.info(
            {
              job_id: job.id,
              duration: Date.now() - job.created_at.getTime()
            },
            '[schema import job]: finish'
          )
        })
      )
    },
    waitForCompletion: true,
    onComplete
  })

  cron.start()
  logger.info(`Started cron job: "${cadence}" Schema Import Worker`)
  return cron
}

const startExpiredJobCron = (onComplete: () => void) => {
  const cadence = config.ENV === 'development' ? every5seconds : every5minutes
  const job = CronJob.from({
    cronTime: cadence,
    onTick: async () => {
      logger.info(
        `Checking for expired schema import jobs (over ${config.SCHEMA_IMPORT_JOB_EXPIRATION_MINUTES} minutes old)`
      )
      const expiredJobs = await ImportJobService.getExpiredJobs(
        config.SCHEMA_IMPORT_JOB_EXPIRATION_MINUTES
      )
      for (const job of expiredJobs) {
        logger.info(
          `Schema import job expired: job_id="${job.id}" connection_id:="${job.connection_id}"`
        )
        void sendAnalyticsSlackNotification({
          message: `Schema import job "${job.id}" for connection "${job.connection_id}" has expired after ${config.SCHEMA_IMPORT_JOB_EXPIRATION_MINUTES} minutes.`,
          logger
        })
      }
    },
    waitForCompletion: true,
    onComplete
  })

  job.start()
  logger.info(`Started cron job: "${cadence}" Expired Schema Import Worker`)
  return job
}

export class SchemaImportWorker extends WorkerBase {
  private jobs: CronJob<() => void, null>[] = []
  private stoppedJobsCount = 0

  constructor() {
    super()
  }

  onCronStop() {
    this.stoppedJobsCount++
  }

  async waitForStop() {
    const maxTimeMs = 60_000
    const startTime = Date.now()
    while (this.stoppedJobsCount < this.jobs.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      if (Date.now() - startTime > maxTimeMs) {
        logger.error(
          'One or more schema import cron jobs did not stop in time. Proceeding with shutdown while jobs are in progress!'
        )
        break
      }
    }
  }

  async runWorker(): Promise<void> {
    try {
      this.jobs.push(startSchemaImportCron(() => this.onCronStop()))
      this.jobs.push(startExpiredJobCron(() => this.onCronStop()))
    } catch (error) {
      const message = 'Error running schema import worker'
      logger.error(error, message)
      notifySentry({ error, message })
      process.exit(-1)
    }
  }

  async stop() {
    logger.info('Stopping schema import cron jobs..')
    this.jobs.forEach(job => job.stop())
    await this.waitForStop()
    logger.info('Finished stopping schema import cron jobs')
    await super.stop()
  }
}
