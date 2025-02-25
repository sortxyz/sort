import { randomBytes } from 'node:crypto'

import { getDb, logger } from '../../../'

import type {
  DatabaseInsert,
  DatabaseSelect
} from '../../../types/kysely/metadata/database.type'
import type { SortDB } from '../../../types/kysely.type'
import type { DeleteResult, Kysely } from 'kysely'

export const randomizeName = (slug: string) => {
  return `${slug}-${randomBytes(3).toString('hex')}`
}

/**
 * Use this to insert a database without any slug logic.
 * @param database
 * @returns
 */
export const rawInsertMetadataDb = async (
  database: DatabaseInsert
): Promise<DatabaseInsert> =>
  await getDb()
    .insertInto('metadata_database')
    .values(database)
    .returningAll()
    .executeTakeFirstOrThrow()

export const selectMetaDataDbByNameAndConnectionId = async (
  sortDb: Kysely<SortDB>,
  rawName: string,
  connectionId: string
): Promise<DatabaseSelect | undefined> =>
  await sortDb
    .selectFrom('metadata_database')
    .where('raw_name', '=', rawName)
    .where('connection_id', '=', connectionId)
    .selectAll()
    .executeTakeFirst()

/**
 * Insert a metadata_database, automatically generating a unique slug.
 */
export const insertMetadataDb = async (
  sortDb: Kysely<SortDB>,
  database: DatabaseInsert
): Promise<DatabaseInsert> => {
  let ret: DatabaseInsert | undefined = undefined
  let attemptCount = 0

  while (attemptCount < 10) {
    try {
      ret = undefined

      database.slug = randomizeName(database.raw_name)

      ret = await sortDb
        .insertInto('metadata_database')
        .values(database)
        .returningAll()
        .executeTakeFirstOrThrow()

      break
    } catch (err) {
      const error = err as Error

      if (
        !(
          error.message &&
          error.message.includes(
            'duplicate key value violates unique constraint "metadata_database_pkey"'
          )
        )
      ) {
        logger.error(
          err,
          `Failed to insert slug for ${database.connection_id} and ${database.raw_name}`
        )
        throw err
      }
    }

    attemptCount++
  }

  if (!ret) {
    throw new Error(
      'Failed to insert database after maximum attempts to attain a unique slug.'
    )
  }

  return ret
}

export const removeMetadataDb = async (
  connection_id: string,
  slug: string
): Promise<DeleteResult> =>
  await getDb()
    .deleteFrom('metadata_database')
    .where('slug', '=', slug)
    .where('connection_id', '=', connection_id)
    .executeTakeFirst()

export const removeMetadataDbsByConnectionIds = async (
  connectionIds: string[]
): Promise<DeleteResult[]> =>
  await getDb()
    .deleteFrom('metadata_database')
    .where('connection_id', 'in', connectionIds)
    .execute()

export const getMetadataDbByOrgAndSlug = async ({
  orgId,
  slug
}: {
  orgId: string
  slug: string
}) =>
  await getDb()
    .selectFrom('metadata_database')
    .where('organization_id', '=', orgId)
    .where('slug', '=', slug)
    .selectAll()
    .executeTakeFirst()

export const getMetadataDbByRawNameAndSlug = async ({
  orgId,
  rawName,
  connectionId
}: {
  orgId: string
  rawName: string
  connectionId?: string
}) => {
  let query = getDb()
    .selectFrom('metadata_database')
    .where('organization_id', '=', orgId)
    .where('raw_name', '=', rawName)

  if (connectionId) {
    query = query.where('connection_id', '=', connectionId)
  }

  return await query.selectAll().executeTakeFirst()
}

export const getDbByOrgAndDbSlug = async ({
  orgSlug,
  dbSlug
}: {
  orgSlug: string
  dbSlug: string
}) => {
  if (!(orgSlug.trim() && dbSlug.trim())) return undefined

  return await getDb()
    .selectFrom('metadata_database')
    .innerJoin(
      'organization',
      'metadata_database.organization_id',
      'organization.id'
    )
    .where('metadata_database.slug', '=', dbSlug)
    .where('organization.slug', '=', orgSlug)
    .selectAll('metadata_database')
    .executeTakeFirst()
}
