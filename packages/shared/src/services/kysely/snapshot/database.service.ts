import { getDb } from '../../../'

import { insertSchema, insertSchemaOld } from './schema.service'

import type {
  DatabaseInsertWithRelations,
  DatabaseSelect
} from '../../../types/kysely/snapshot/database.type'
import type { SortDB } from '../../../types/kysely.type'
import type { Kysely } from 'kysely'

export const insertDatabase = async (
  sortDb: Kysely<SortDB>,
  connectionId: string,
  database: DatabaseInsertWithRelations
) => {
  const schemas = database.insertSchemas

  delete database.insertSchemas

  const id = await sortDb
    .insertInto('snapshot_database')
    .values(database)
    .returning(['id'])
    .executeTakeFirstOrThrow()

  if (schemas && schemas.length) {
    for (const sc of schemas) {
      await insertSchema(sortDb, connectionId, database.name, sc)
    }
  }

  return id
}

/** @deprecated Use insertDatabase instead */
export const insertDatabaseOld = async (
  sortDb: Kysely<SortDB>,
  database: DatabaseInsertWithRelations
): Promise<{ id: string }> => {
  const schemas = database.insertSchemas

  delete database.insertSchemas

  const id = await sortDb
    .insertInto('snapshot_database')
    .values(database)
    .returning(['id'])
    .executeTakeFirstOrThrow()

  if (schemas && schemas.length) {
    for (const sc of schemas) {
      await insertSchemaOld(sortDb, sc)
    }
  }

  return id
}

export const getDatabasesCountBySnapshot = async (
  snapshotId: string
): Promise<{ count: number }> =>
  await getDb()
    .selectFrom('snapshot_database')
    .select(({ fn }) => [fn.count<number>('id').as('count')])
    .where('snapshot_id', '=', snapshotId)
    .executeTakeFirstOrThrow()

export const getDatabasesWithSchemas = async (snapshotId: string) =>
  await getDb()
    .selectFrom('snapshot_database')
    .innerJoin(
      'snapshot_schema',
      'snapshot_schema.database_id',
      'snapshot_database.id'
    )
    .innerJoin('snapshot', 'snapshot.id', 'snapshot_database.snapshot_id')
    .innerJoin('metadata_database', join =>
      join
        .onRef('metadata_database.raw_name', '=', 'snapshot_database.name')
        .onRef('metadata_database.connection_id', '=', 'snapshot.connection_id')
    )
    .where('snapshot_database.snapshot_id', '=', snapshotId)
    .select([
      'snapshot.connection_id',
      'snapshot_database.id',
      'snapshot_database.name',
      'snapshot_database.snapshot_id',
      'metadata_database.display_name',
      'metadata_database.slug',
      'metadata_database.summary',
      'metadata_database.link',
      'metadata_database.organization_id'
    ])
    .select(({ fn }) => [
      fn.agg<string[]>('array_agg', ['snapshot_schema.name']).as('schemaNames')
    ])
    .groupBy([
      'snapshot.connection_id',
      'snapshot_database.id',
      'snapshot_database.name',
      'snapshot_database.snapshot_id',
      'metadata_database.display_name',
      'metadata_database.slug',
      'metadata_database.summary',
      'metadata_database.link',
      'metadata_database.organization_id'
    ])
    .orderBy('metadata_database.display_name', 'asc')
    .execute()

export const getDatabase = async (
  databaseId: string
): Promise<DatabaseSelect | undefined> =>
  await getDb()
    .selectFrom('snapshot_database')
    .where('id', '=', databaseId)
    .selectAll()
    .executeTakeFirst()

export const getDatabaseByName = async (
  snapshotId: string,
  databaseName: string
): Promise<DatabaseSelect | undefined> =>
  await getDb()
    .selectFrom('snapshot_database')
    .where('snapshot_id', '=', snapshotId)
    .where('name', '=', databaseName)
    .selectAll()
    .executeTakeFirst()

export const getDatabaseBySlug = async ({
  snapshotId,
  dbSlug
}: {
  snapshotId: string
  dbSlug: string
}): Promise<DatabaseSelect | undefined> =>
  await getDb()
    .selectFrom('snapshot_database')
    .innerJoin(
      'metadata_database',
      'metadata_database.raw_name',
      'snapshot_database.name'
    )
    .where('snapshot_id', '=', snapshotId)
    .where('metadata_database.slug', '=', dbSlug)
    .selectAll('snapshot_database')
    .executeTakeFirst()

export const removeDatabase = async (id: string) =>
  await getDb().deleteFrom('snapshot_database').where('id', '=', id).execute()
