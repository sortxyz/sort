import { getDb } from '../../../'
import { DEFAULT_DATABASE_DESCRIPTION } from '../../../constants/metadata.constant'
import {
  insertMetadataDb,
  selectMetaDataDbByNameAndConnectionId
} from '../metadata/database.service'

import { insertDatabase } from './database.service'

import type { DatabaseInsert } from '../../../types/kysely/metadata/database.type'
import type {
  SnapshotInsert,
  SnapshotSelect,
  SnapshotUpdateWithRelations
} from '../../../types/kysely/snapshot/snapshot.type'
import type { SortDB } from '../../../types/kysely.type'
import type { DeleteResult, Kysely } from 'kysely'

export const insertSnapshot = async (
  sortDb: Kysely<SortDB>,
  snapshot: SnapshotInsert
): Promise<{ id: string }> =>
  await sortDb
    .insertInto('snapshot')
    .values(snapshot)
    .returning(['id'])
    .executeTakeFirstOrThrow()

export const updateSnapshot = async (
  sortDb: Kysely<SortDB>,
  organizationId: string,
  snapshot: SnapshotUpdateWithRelations,
  id: string
): Promise<{ id: string }> => {
  if (snapshot.insertDatabases && snapshot.insertDatabases.length) {
    for (const insertDb of snapshot.insertDatabases) {
      await insertDatabase(sortDb, snapshot.connection_id, insertDb)

      // check to make sure we haven't already added a metadata record for this connection_id and raw_name
      const existingMetadataDb = await selectMetaDataDbByNameAndConnectionId(
        sortDb,
        insertDb.name,
        snapshot.connection_id
      )

      if (existingMetadataDb) {
        continue
      }

      // create our metadata record, as it doesn't exist
      const metadataDbData = {
        connection_id: snapshot.connection_id,
        organization_id: organizationId,
        raw_name: insertDb.name,
        slug: insertDb.name,
        display_name: insertDb.name,
        description: DEFAULT_DATABASE_DESCRIPTION
      } satisfies DatabaseInsert

      const metadataDb = await insertMetadataDb(sortDb, metadataDbData)
      if (metadataDb) {
        // add defaults
        const defaultLabels = await sortDb
          .selectFrom('default_label')
          .selectAll()
          .execute()

        for (const label of defaultLabels) {
          await sortDb
            .insertInto('label')
            .values({
              metadata_database_connection_id: metadataDb.connection_id,
              metadata_database_raw_name: metadataDb.raw_name,
              name: label.name,
              color: label.color,
              description: label.description
            })
            .executeTakeFirstOrThrow()
        }
      }
    }
  }

  delete snapshot.insertDatabases

  return await sortDb
    .updateTable('snapshot')
    .where('id', '=', id)
    .set(snapshot)
    .returning(['id'])
    .executeTakeFirstOrThrow()
}

export const getSnapshotById = async (id: string) =>
  await getDb()
    .selectFrom('snapshot')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()

export const getCurrentSnapshot = async (
  connectionId: string
): Promise<SnapshotSelect | undefined> =>
  await getDb()
    .selectFrom('snapshot')
    .where('connection_id', '=', connectionId)
    .where('status', '=', 'COMPLETED')
    .orderBy('timestamp', 'desc')
    .limit(1)
    .selectAll()
    .executeTakeFirst()

export const removeSnapshot = async (id: string): Promise<DeleteResult> =>
  await getDb().deleteFrom('snapshot').where('id', '=', id).executeTakeFirst()
