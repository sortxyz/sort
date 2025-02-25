import { randomUUID } from 'node:crypto'

import { sql } from 'kysely'

import { getDb } from '../..'

import type { SortDB, SchemaJob } from '../../types/kysely.type'
import type { Selectable, Kysely } from 'kysely'

/**
 * Creates a schema import job.
 *
 * If `undefined` is returned, it means an import job is already underway for
 * the connection. Otherwise, the new job is returned.
 */
export const createJob = async ({
  user_id,
  connection_id
}: {
  user_id: string
  connection_id: string
}) => {
  const now = new Date()

  const insert = sql<
    Selectable<SortDB['schema_job']> | undefined
  >`INSERT INTO "schema_job"
    ("id", "status", "created_at", "updated_at", "connection_id", "user_id")
    SELECT ${randomUUID()}, 'PENDING', ${now}, ${now}, ${connection_id}, ${user_id}
    WHERE NOT EXISTS (
      SELECT 1
      FROM "schema_job"
      WHERE "connection_id" = ${connection_id}
        AND ("end_time" IS NULL OR "status" = 'RUNNING' OR "status" = 'PENDING')
    )
    RETURNING *;`

  const result = await insert.execute(getDb())
  return result.rows[0]
}

export const getPendingJobs = async (limit = 1) => {
  const pendingJobs = await getDb()
    .selectFrom('schema_job')
    .where('schema_job.status', '=', 'PENDING')
    .selectAll(['schema_job'])
    .orderBy('created_at', 'desc')
    .limit(limit)
    .execute()

  return pendingJobs
}

/**
 * @param minutes Jobs created more than `minutes` ago are consider expired
 */
export const getExpiredJobs = async (minutes: number) => {
  return await getDb()
    .selectFrom('schema_job')
    .where(eb =>
      eb.or([
        eb.and([
          eb('status', '=', 'PENDING'),
          eb(
            'created_at',
            '<',
            new Date(new Date().getTime() - 1000 * 60 * minutes)
          )
        ]),
        eb.and([
          eb('status', '=', 'RUNNING'),
          eb(
            'start_time',
            '<',
            new Date(new Date().getTime() - 1000 * 60 * minutes)
          )
        ])
      ])
    )
    .selectAll()
    .execute()
}

export const getJobById = async (db: Kysely<SortDB>, id: string) => {
  return await db
    .selectFrom('schema_job')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirstOrThrow()
}

export const updateJobById = async (
  db: Kysely<SortDB>,
  id: string,
  updates: Partial<
    Pick<
      Selectable<SchemaJob>,
      'status' | 'end_time' | 'error_message' | 'start_time'
    >
  >
) => {
  if (!updates || Object.keys(updates).length === 0) {
    throw new Error('At least one field is required to update the job.')
  }

  const updatedJob = await db
    .updateTable('schema_job')
    .where('id', '=', id)
    .set({
      ...updates,
      updated_at: new Date()
    })
    .returningAll()
    .executeTakeFirst()

  return updatedJob
}
