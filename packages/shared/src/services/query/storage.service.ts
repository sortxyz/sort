import { sql } from 'kysely'

import { getDb } from '../../'

import type {
  Query,
  RequestIntentQuery,
  RequestSqlQuery,
  BaseQuery
} from '../../schemas/query-execution.schema'

export type QueryArg = {
  connectionId: string
  databaseName: string
  query: Query
  userId: string
}

export const insert = async (arg: QueryArg) => {
  if (!arg) {
    throw new Error('arg is required')
  }

  const { databaseName, connectionId, userId, query } = arg

  return await getDb()
    .insertInto('query')
    .values({
      type: query.type,
      sql: query.type === 'sql' ? query.sql : null,
      intent:
        query.type === 'intent'
          ? sql`CAST(${JSON.stringify(query.intent)} AS JSONB)`
          : null,
      created_by: userId,
      created_at: new Date(),
      updated_at: new Date(),
      name: query.name || new Date().toISOString(),
      description: query.description ?? null,
      database_name: databaseName,
      connection_id: connectionId
    })
    .returningAll()
    .executeTakeFirstOrThrow()
}

export type UpdateQueryArg = {
  connectionId: string
  databaseName: string
  query: RequestIntentQuery | RequestSqlQuery | BaseQuery
}
export const update = async (
  where: { id: string; userId: string; orgId: string },
  update: Partial<UpdateQueryArg>
) => {
  if (!where) {
    throw new Error('where is required')
  }

  if (!String(where.id).trim().length) {
    throw new Error('where.id is required')
  }

  if (!String(where.userId).trim().length) {
    throw new Error('where.userId is required')
  }

  if (!String(where.orgId).trim().length) {
    throw new Error('where.orgId is required')
  }

  if (!update) {
    throw new Error('update is required')
  }

  const set: Record<string, unknown> = {}

  if (update.connectionId) {
    set.connection_id = update.connectionId
  }

  if (update.databaseName) {
    set.database_name = update.databaseName
  }

  if (update.query) {
    if ('type' in update.query) {
      set.type = update.query.type
      set.sql = update.query.type === 'sql' ? update.query.sql : null
      set.intent =
        update.query.type === 'intent'
          ? sql`CAST(${JSON.stringify(update.query.intent)} AS JSONB)`
          : null
    }
    if (Object.hasOwn(update.query, 'name')) {
      set.name = update.query.name ?? null
    }
    if (Object.hasOwn(update.query, 'description')) {
      set.description = update.query.description ?? null
    }
  }

  set.updated_at = new Date()

  return await getDb()
    .updateTable('query')
    .where('query.id', '=', where.id)
    .where('query.created_by', '=', where.userId)
    .where('query.connection_id', 'in', qb => {
      return qb
        .selectFrom('connection')
        .where('connection.organization_id', '=', where.orgId)
        .select('id')
    })
    .set(set)
    .returningAll()
    .executeTakeFirst()
}
