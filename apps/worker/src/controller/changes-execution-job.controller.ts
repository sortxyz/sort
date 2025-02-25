import { notifySentry } from '@sort/logger'
import { getDb } from '@sort/shared'
import { ChangeRequestNotificationSource } from '@sort/shared/constants/notifications.constant'
import { ExecutionFailureError } from '@sort/shared/errors/change-requests/execution-failure.error'
import { ZeroAffectedRowsError } from '@sort/shared/errors/change-requests/query-execution.error'
import { UnknownValueError } from '@sort/shared/errors/change-requests/unknown.error'
import { NotFoundError } from '@sort/shared/errors/not-found.error'
import { PublicFacingError } from '@sort/shared/errors/public-facing.error'
import * as ChangeRequestService from '@sort/shared/services/change-requests/change-request.service'
import * as ChangeService from '@sort/shared/services/changes/change.service'
import { getChangeJobById } from '@sort/shared/services/changes/job.service'
import * as ChangeJobService from '@sort/shared/services/changes/job.service'
import { KyselyExtractor } from '@sort/shared/services/changes/kysely-extractor.service'
import { addPrimaryKeys } from '@sort/shared/services/changes/previous-change.service'
import * as DatabaseService from '@sort/shared/services/kysely/metadata/database.service'
import { sendChangeRequestNotification } from '@sort/shared/services/notification.service'
import * as OrganizationService from '@sort/shared/services/org.service'
import { getSortBotSvcUser } from '@sort/shared/services/user.service'
import { changeDatabaseOfConnectionString } from '@sort/shared/utils/connection.util'
import { EncryptedField } from '@sort/shared/utils/crypt.util'
import { hydrateSQLString } from '@sort/shared/utils/string.util'
import { Kysely, PostgresDialect } from 'kysely'

import { config, logger } from '../config/bootstrap'
import { createPgPool } from '../utils/connection.util'

import type { SortLogger } from '@sort/logger'
import type { Organization } from '@sort/shared/schemas/org.schema'
import type * as ChangeType from '@sort/shared/types/change-request.types'
import type { SortDB } from '@sort/shared/types/kysely.type'
import type { Selectable } from 'kysely'

type MetadataDatabase = SortDB['metadata_database']

export class ChangesExecutionJobController {
  log: SortLogger

  constructor(private readonly job: ChangeType.ChangeRequestJobSelect) {
    this.log = this.createLogger()
  }

  private async beginJob() {
    return await getDb()
      .transaction()
      .execute(async trx => {
        const job = await getChangeJobById(trx, this.job.id)
        if (!job || job?.status !== 'PENDING') {
          throw new Error('Job not pending')
        }

        await ChangeJobService.updateJob(trx, this.job.id, 'RUNNING', {
          start_time: new Date()
        })
      })
  }

  public async runJob() {
    const allSqlCompiled: string[] = []
    const allParamsCompiled: ReadonlyArray<unknown>[] = []
    let numAffectedRows = 0
    let sql: string = ''
    let params: ReadonlyArray<unknown> = []
    let org: Organization | undefined
    let database: Selectable<MetadataDatabase> | undefined
    let changeRequest: ChangeType.ChangeRequestSelect | undefined

    try {
      await this.beginJob()

      // retrieve values we'll need
      const changes = await ChangeService.getChangesForChangeRequestId(
        this.job.change_request_id
      )
      changeRequest = await ChangeRequestService.getChangeRequestById(
        this.job.change_request_id
      )
      const connection = await ChangeService.getConnectionForChangeRequestId(
        this.job.change_request_id
      )
      org = await OrganizationService.getById(connection.organization_id)
      if (!org) {
        throw new NotFoundError('organization')
      }
      database = await DatabaseService.getMetadataDbByRawNameAndSlug({
        orgId: org.id,
        rawName: changeRequest.metadata_database_raw_name,
        connectionId: connection.id
      })
      if (!database) {
        throw new NotFoundError('database')
      }

      await sendChangeRequestNotification({
        org,
        database,
        changeRequest,
        htmlMessage: `Change Request #${changeRequest.change_request_number} execution started`,
        logger: this.log,
        source: ChangeRequestNotificationSource.JOB_CONTROLLER
      })

      // customer's database provider
      const provider = await this.getSQLProvider(database.raw_name)

      // compile our changes into sql and extract sql/params
      const kyselyChanges = new KyselyExtractor(changeRequest, changes)
      await kyselyChanges.setupChanges()
      const extractedSqlPayloads = kyselyChanges.extractSQL()

      const addQueryPrimaryKeys: {
        rows: unknown[]
        change: ChangeType.ChangeSelect
        keys?: string[]
      }[] = []

      await provider.transaction().execute(async trx => {
        let queryResult

        for (const changeSql of extractedSqlPayloads) {
          try {
            const compiled = changeSql.statement.compile(provider)

            sql = compiled.sql
            params = compiled.parameters

            queryResult = await trx.executeQuery(compiled)

            if (changeSql.change.action === 'ADD') {
              addQueryPrimaryKeys.push({
                rows: queryResult.rows,
                change: changeSql.change,
                keys: changeSql.keys
              })
            }

            allSqlCompiled.push(sql)
            allParamsCompiled.push(params)
          } catch (error) {
            const err = error as Error
            throw new ExecutionFailureError(
              err.message,
              sql,
              params,
              changeSql.change,
              { cause: err }
            )
          }

          if (!queryResult || queryResult.numAffectedRows === BigInt(0)) {
            throw new ZeroAffectedRowsError(sql, params, changeSql.change)
          }

          numAffectedRows += Number(queryResult.numAffectedRows)
        }

        // store created primary keys for ADD changes
        await getDb()
          .transaction()
          .execute(async trx => {
            await Promise.all(
              addQueryPrimaryKeys.map(async ({ rows, change, keys }) => {
                // TODO: this needs to be move on to the next step for V1,
                // but in V2, make sure this check throws to the user
                if (!keys) return

                const record = rows[0] as Record<string, unknown>

                await addPrimaryKeys(trx, connection, change, keys, record)
              })
            )
          })
      })

      await this.endJob({
        numAffectedRows,
        sql: allSqlCompiled,
        params: allParamsCompiled,
        org,
        database,
        changeRequest
      })
    } catch (e) {
      await this.endJobWithError({
        error: e as Error,
        errorParams: params,
        errorSql: sql,
        org,
        database,
        changeRequest,
        allParams: allParamsCompiled,
        allSql: allSqlCompiled
      })
    }
  }

  private async endJobWithError({
    errorSql,
    errorParams,
    error,
    allSql,
    allParams,
    org,
    database,
    changeRequest
  }: {
    errorSql: string
    errorParams: ReadonlyArray<unknown>
    error: Error
    allSql: string[]
    allParams: ReadonlyArray<unknown>[]
    org?: Organization
    database?: Selectable<MetadataDatabase>
    changeRequest?: ChangeType.ChangeRequestSelect
  }) {
    let message = error instanceof Error ? error.message : 'Unknown error'

    if (error instanceof ZeroAffectedRowsError) {
      // not a bug in our code
      this.log.info(error.cause, 'Zero affected rows')
    } else {
      let err
      if (error instanceof UnknownValueError) {
        err = error.cause
        message = 'Unknown value error'
      } else if (error instanceof NotFoundError && error.entity === 'column') {
        err = error.context
        message = 'Column not found error'
      } else {
        err = error
      }
      this.log.error(err, message)
      notifySentry({ error: err, message, contextId: this.job.id })
    }

    const now = new Date()
    try {
      await getDb()
        .transaction()
        .execute(async trx => {
          await ChangeJobService.updateJob(
            trx,
            this.job.id,
            'FAILED',
            {
              error_message: message,
              end_time: now
            },
            {
              sql: allSql,
              params: allParams
            }
          )

          await ChangeRequestService.updateChangeRequestStatus(
            trx,
            this.job.change_request_id,
            'approved',
            now
          )

          const code =
            error instanceof PublicFacingError ? error.code : 'SERVICE_ERROR'

          const { id: userId } = await getSortBotSvcUser(trx, config)

          await ChangeRequestService.addHistoryItem(
            {
              trx,
              changeRequestId: this.job.change_request_id,
              currentDate: now,
              userId
            },
            'FAIL_EXECUTE',
            {
              code,
              change_request_job_id: this.job.id,
              sql:
                error instanceof PublicFacingError
                  ? hydrateSQLString(errorSql, errorParams)
                  : undefined,
              reason:
                error instanceof PublicFacingError
                  ? error.message
                  : 'Execution failed'
            }
          )
        })

      if (org && database && changeRequest) {
        await sendChangeRequestNotification({
          org,
          database,
          changeRequest,
          htmlMessage: `Change Request #${changeRequest.change_request_number} execution failed`,
          logger: this.log,
          source: ChangeRequestNotificationSource.JOB_CONTROLLER
        })
      }
    } catch (err) {
      const msg = 'Failed to update job state to FAILED.'
      this.log.error(err, msg)
      notifySentry({ error: err, message: msg, contextId: this.job.id })
    }
  }

  private async endJob({
    numAffectedRows,
    sql,
    params,
    org,
    database,
    changeRequest
  }: {
    numAffectedRows: number
    sql: string[]
    params: ReadonlyArray<unknown>[]
    org: Organization
    database: Selectable<MetadataDatabase>
    changeRequest: ChangeType.ChangeRequestSelect
  }) {
    const now = new Date()
    try {
      await getDb()
        .transaction()
        .execute(async trx => {
          await ChangeJobService.updateJob(
            trx,
            this.job.id,
            'COMPLETED',
            {
              rows_affected: numAffectedRows,
              end_time: now
            },
            {
              sql: sql,
              params: params
            }
          )

          await ChangeRequestService.updateChangeRequestStatus(
            trx,
            this.job.change_request_id,
            'applied',
            now
          )

          const { id: userId } = await getSortBotSvcUser(trx, config)
          await ChangeRequestService.addHistoryItem(
            {
              trx,
              changeRequestId: this.job.change_request_id,
              currentDate: now,
              userId
            },
            'COMPLETE_EXECUTE',
            {
              change_request_job_id: this.job.id,
              num_affected_rows: numAffectedRows
            }
          )
        })

      await sendChangeRequestNotification({
        org,
        database,
        changeRequest,
        htmlMessage: `Change Request #${changeRequest.change_request_number} was successfully applied`,
        logger: this.log,
        source: ChangeRequestNotificationSource.JOB_CONTROLLER
      })

      this.log.info(
        {
          changeRequestId: this.job.change_request_id,
          numAffectedRows: numAffectedRows
        },
        'Change request job succeeded'
      )
    } catch (err) {
      const msg = 'Failed to update job state to COMPLETED.'
      this.log.error(err, msg)
      notifySentry({ error: err, message: msg, contextId: this.job.id })
    }
  }

  private async getSQLProvider(dbName: string) {
    const connection = await ChangeService.getConnectionForChangeRequestId(
      this.job.change_request_id
    )

    const connString = await EncryptedField.fromEncryptedValue(
      connection.connection_string
    ).decrypt()

    const connStringWithDb = changeDatabaseOfConnectionString({
      connectionString: connString,
      dbName,
      dataProvider: 'postgres'
    })

    const pool = createPgPool(connStringWithDb, connection.with_ssl, {
      max: 100,
      allowExitOnIdle: true
    })

    const db = new Kysely({
      dialect: new PostgresDialect({
        pool
      })
    })

    return db
  }

  /**
   * Creates a fastify-like logging interface which uses our global logger and passes
   * along the job id in all logs.
   */
  private createLogger() {
    if (this.log) return this.log
    return logger.child({ contextId: this.job.id })
  }
}
