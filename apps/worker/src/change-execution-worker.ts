import { notifySentry } from '@sort/logger'
import * as ChangeJobService from '@sort/shared/services/changes/job.service'
import { sendAnalyticsSlackNotification } from '@sort/shared/services/slack.service'
import { CronJob } from 'cron'

import { logger, config } from './config/bootstrap'
import { everyMinute, every5seconds, every5minutes } from './config/cron'
import { ChangesExecutionJobController } from './controller/changes-execution-job.controller'
import { WorkerBase } from './worker.base'

const startChangeExecutionCron = (onComplete: () => void) => {
  const cadence = config.ENV === 'development' ? every5seconds : everyMinute
  const job = CronJob.from({
    cronTime: cadence,
    onTick: async () => {
      logger.info('Checking for any pending change request jobs')
      const pendingChangeJobs = await ChangeJobService.getPendingChangeJobs()
      const batchDate = new Date().toISOString()
      for (const changeJob of pendingChangeJobs) {
        logger.info(
          `Starting change job: ${changeJob.id} for batch date: ${batchDate}`,
          undefined,
          changeJob.id
        )
        const ctrl = new ChangesExecutionJobController(changeJob)
        await ctrl.runJob()
      }
    },
    waitForCompletion: true,
    onComplete
  })

  job.start()
  logger.info(`Started cron job: "${cadence}" Change Execution Worker`)
  return job
}

const startExpiredChangeCron = (onComplete: () => void) => {
  const cadence = config.ENV === 'development' ? every5seconds : every5minutes
  const job = CronJob.from({
    cronTime: cadence,
    onTick: async () => {
      logger.info(
        `Checking for any expired change request jobs (over ${config.CHANGE_JOB_EXPIRATION_MINUTES} minutes old)`
      )
      const expiredChangeJobs = await ChangeJobService.getExpiredChangeJobs(
        config.CHANGE_JOB_EXPIRATION_MINUTES
      )
      for (const changeJob of expiredChangeJobs) {
        logger.info(
          `Expiring change job: ${changeJob.id} with request id: ${changeJob.change_request_id}`
        )
        void sendAnalyticsSlackNotification({
          message: `Change job ${changeJob.id} for request ${changeJob.change_request_id} has expired after ${config.CHANGE_JOB_EXPIRATION_MINUTES} minutes.`,
          logger
        })
      }
    },
    waitForCompletion: true,
    onComplete
  })

  job.start()
  logger.info(`Started cron job: "${cadence}" Expired Change Worker`)
  return job
}

export class ChangeExecutionWorker extends WorkerBase {
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
          'One or more change execution cron jobs did not stop in time. Proceeding with shutdown while jobs are in progress!'
        )
        break
      }
    }
  }

  async runWorker(): Promise<void> {
    try {
      this.jobs.push(startChangeExecutionCron(() => this.onCronStop()))
      this.jobs.push(startExpiredChangeCron(() => this.onCronStop()))
    } catch (error) {
      const message = 'Error running change execution worker'
      logger.error(error, message)
      notifySentry({ error, message })
      process.exit(-1)
    }
  }

  async stop() {
    logger.info('Stopping change execution cron jobs..')
    this.jobs.forEach(job => job.stop())
    await this.waitForStop()
    logger.info('Finished stopping change execution cron jobs')
    await super.stop()
  }
}
