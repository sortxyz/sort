import { getDb } from '../../../'

import type { ColumnInsert } from '../../../types/kysely/snapshot/column.type'
import type * as kyselyType from '../../../types/kysely.type'
import type { Kysely } from 'kysely'

export const insertColumn = async (
  sortDb: Kysely<kyselyType.SortDB>,
  column: ColumnInsert
) =>
  await sortDb
    .insertInto('snapshot_column')
    .values(column)
    .returning(['id'])
    .executeTakeFirstOrThrow()

export const getColumnsByTableId = async (tableId: string) =>
  await getDb()
    .selectFrom('snapshot_column')
    .where('table_id', '=', tableId)
    .selectAll()
    .execute()

export const getPrimaryKeys = async (tableId: string) =>
  await getDb()
    .selectFrom('snapshot_column')
    .where('table_id', '=', tableId)
    .where('is_primary_key', '=', true)
    .selectAll()
    .execute()

export const removeColumn = async (id: string) =>
  await getDb().deleteFrom('snapshot_column').where('id', '=', id).execute()
