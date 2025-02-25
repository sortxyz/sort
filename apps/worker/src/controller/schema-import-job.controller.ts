import { notifySentry } from '@sort/logger'
import { getDb } from '@sort/shared'
import * as ConnectionService from '@sort/shared/services/connection.service'
import * as JobService from '@sort/shared/services/schema-import/job.service'
import { sendAnalyticsSlackNotification } from '@sort/shared/services/slack.service'
import { createSchemaImporter } from '@sort/shared/utils/schema-import.util'

import { config, logger } from '../config/bootstrap'

import type { SortLogger } from '@sort/logger'
import type { SortDB } from '@sort/shared/types/kysely.type'
import type { FastifyBaseLogger } from 'fastify'
import type { Selectable } from 'kysely'

export class SchemaImportJobController {
  logger: SortLogger

  constructor(private readonly job: Selectable<SortDB['schema_job']>) {
    this.logger = this.createLogger()
  }

  private async beginJob() {
    return await getDb()
      .transaction()
      .execute(async trx => {
        const job = await JobService.getJobById(trx, this.job.id)
        if (!job || job?.status !== 'PENDING') {
          throw new Error('Job not pending')
        }

        await JobService.updateJobById(trx, this.job.id, {
          status: 'RUNNING',
          start_time: new Date()
        })
      })
  }

  public async runJob() {
    let connection: Awaited<ReturnType<typeof ConnectionService.getById>>

    try {
      await this.beginJob()

      connection = await ConnectionService.getById(this.job.connection_id)
      if (!connection) {
        throw new Error('Connection not found')
      }

      const schemaImporter = createSchemaImporter(connection)
      await schemaImporter.importSchema(
        this.job.user_id,
        this.logger as unknown as FastifyBaseLogger
      )

      this.logger.info(
        `Schema import succeeded for connection "${connection.id}".`
      )

      await JobService.updateJobById(getDb(), this.job.id, {
        status: 'COMPLETED',
        end_time: new Date()
      })
    } catch (err) {
      this.logger.error(
        err,
        `Schema import failed for connection "${connection?.id}".`
      )

      await JobService.updateJobById(getDb(), this.job.id, {
        status: 'FAILED',
        error_message: err instanceof Error ? err.message : 'Unknown error',
        end_time: new Date()
      })

      if (config.IS_PROD_ENV) {
        const message = 'Error running schema import job'
        notifySentry({ error: err, message, contextId: this.job.id })

        void sendAnalyticsSlackNotification({
          message: `Connection failed to import. user_id="${this.job.user_id}" connection_name="${connection?.name}" connection_id="${connection?.id}"`,
          logger: this.logger
        })
      }
    }
  }

  /**
   * Creates a fastify-like logging interface which uses our global logger and passes
   * along the job id in all logs.
   */
  private createLogger() {
    if (this.logger) return this.logger
    return logger.child({ contextId: this.job.id })
  }
}
