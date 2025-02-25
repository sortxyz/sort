import { randomUUID } from 'node:crypto'

import { sql } from 'kysely'

import { getConfig, getDb, logger } from '../../'
import { JobExistsError } from '../../errors/job-exists.error'

import type { ChangeRequestJob } from '../../schemas/change-request-job.schema'
import type {
  ChangeRequestJobStatus,
  ChangeRequestJobSelect
} from '../../types/change-request.types'
import type { SortDB } from '../../types/kysely.type'
import type { Transaction, Selectable, Kysely } from 'kysely'

/**
 * Creates a change request execution job to be picked up and
 * executed asynchronously by our worker.
 *
 * Only one job can be in progress per change request at a time. When
 * job `end_time` column is null, it is considered in progress.
 */
export const createJob = async (
  trx: Transaction<SortDB>,
  changeRequestId: string
) => {
  const now = new Date()

  const insert = sql<
    Selectable<SortDB['change_request_job']>
  >`INSERT INTO "change_request_job"
    ("id", "change_request_id", "status", "created_at", "updated_at")
    SELECT ${randomUUID()}, ${changeRequestId}, 'PENDING', ${now}, ${now}
    WHERE NOT EXISTS (
      SELECT 1
      FROM "change_request_job"
      WHERE "change_request_id" = ${changeRequestId}
        AND ("end_time" IS NULL OR "status" = 'RUNNING' OR "status" = 'PENDING')
    )
    RETURNING *;`

  const result = await insert.execute(trx)
  if (!result.rows.length) {
    throw new JobExistsError(changeRequestId)
  }

  return result.rows[0]
}

/** ONLY to be used in tests. */
export const insertTestJob = async (changeRequestJob: ChangeRequestJob) => {
  if (getConfig().IS_TEST_ENV !== true) {
    throw new Error('This function is only available in test environment.')
  }

  return await getDb()
    .insertInto('change_request_job')
    .values(changeRequestJob)
    .returningAll()
    .executeTakeFirstOrThrow()
}

/**
 * Gets pending change jobs for execution
 * @returns
 */
export const getPendingChangeJobs = async () => {
  const pendingJobs = await getDb()
    .selectFrom('change_request_job')
    .innerJoin(
      'change_request',
      'change_request.id',
      'change_request_job.change_request_id'
    )
    .innerJoin(
      'connection',
      'connection.id',
      'change_request.metadata_database_connection_id'
    )
    .where('change_request_job.status', '=', 'PENDING')
    .selectAll(['change_request_job'])
    .select([
      'change_request.metadata_database_connection_id',
      'change_request.metadata_database_raw_name'
    ])
    .orderBy('change_request_job.created_at', 'desc')
    .execute()

  // only select the first job from each connection_id, database_name pair
  const uniqueJobs = new Map<string, ChangeRequestJobSelect>()
  pendingJobs.forEach(job => {
    const key = `${job.metadata_database_connection_id}-${job.metadata_database_raw_name}`
    if (!uniqueJobs.has(key)) {
      uniqueJobs.set(key, {
        change_request_id: job.change_request_id,
        created_at: job.created_at,
        id: job.id,
        status: job.status,
        updated_at: job.updated_at,
        error_message: job.error_message,
        rows_affected: job.rows_affected,
        start_time: job.start_time,
        end_time: job.end_time
      } satisfies ChangeRequestJobSelect)
    }
  })

  return Array.from(uniqueJobs.values())
}

export const getExpiredChangeJobs = async (timeInMinutes: number) => {
  return await getDb()
    .selectFrom('change_request_job')
    .where('status', 'in', ['PENDING', 'RUNNING'])
    .where(
      'end_time',
      '<',
      new Date(new Date().getTime() - 1000 * 60 * timeInMinutes)
    )
    .selectAll()
    .execute()
}

export const getChangeJobById = async (db: Kysely<SortDB>, id: string) => {
  return await db
    .selectFrom('change_request_job')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Updates a change request job status
 * @param job
 * @param status
 * @param options
 */
export const updateJob = async (
  db: Kysely<SortDB>,
  id: string,
  status: ChangeRequestJobStatus,
  updates?: Partial<
    Pick<
      ChangeRequestJobSelect,
      'end_time' | 'error_message' | 'rows_affected' | 'start_time'
    >
  >,
  options?: {
    sql?: string[]
    params?: ReadonlyArray<unknown>[]
    errorSql?: string
    errorParams?: ReadonlyArray<unknown>
  }
) => {
  if (updates && Object.keys(updates).length === 0) {
    throw new Error('At least one field is required to update the job.')
  }

  // update the job status and save it
  const updatedJob = await db
    .updateTable('change_request_job')
    .set({
      status,
      updated_at: new Date(),
      ...updates
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst()

  // TODO: implement a more robust solution where we log this stuff to another table, for now
  // let's just throw it in the logger

  // log our params and sql
  if (options?.sql) {
    for (const sql of options.sql) {
      const idx = options.sql.indexOf(sql)
      const params = options.params?.[idx]
      logger.info(`updateJob(@${idx}): ${sql} ${String(params)} for ${id}`)
    }
  }

  if (options?.errorSql) {
    logger.debug(
      `updateJob: ${options.errorSql} ${String(options.errorParams)} for ${id}`
    )
  }

  return updatedJob
}
