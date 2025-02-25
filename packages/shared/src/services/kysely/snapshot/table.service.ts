import { getDb } from '../../../'
import { MissingTableError } from '../../../errors/missing-table.error'
import {
  getTable,
  insertTable as insertMetadataTable
} from '../metadata/table.service'

import { getColumnsByTableId, insertColumn } from './column.service'

import type { TableInsert } from '../../../types/kysely/metadata/table.type'
import type { ColumnSelect } from '../../../types/kysely/snapshot/column.type'
import type {
  TableInsertWithRelations,
  TableSelect
} from '../../../types/kysely/snapshot/table.type'
import type { SortDB } from '../../../types/kysely.type'
import type { Kysely } from 'kysely'

export const insertTable = async (
  sortDb: Kysely<SortDB>,
  connectionId: string,
  databaseName: string,
  schemaName: string,
  table: TableInsertWithRelations
) => {
  const columns = table.insertColumns

  delete table.insertColumns

  const id = await sortDb
    .insertInto('snapshot_table')
    .values(table)
    .returning(['id'])
    .executeTakeFirstOrThrow()

  if (columns && columns.length) {
    for (const col of columns) {
      await insertColumn(sortDb, col)
    }
  }

  // check to make sure we haven't already added a metadata record already
  const existingTable = await getTable(
    connectionId,
    table.name,
    schemaName,
    databaseName
  )
  if (!existingTable) {
    // create our metadata record, as it doesn't exist
    const metadataTable = {
      connection_id: connectionId,
      raw_name: table.name,
      raw_schema_name: schemaName,
      raw_database_name: databaseName,
      display_name: table.name,
      summary: ''
    } satisfies TableInsert

    await insertMetadataTable(metadataTable)
  }

  return id
}

export const getTableByName = async (
  schemaId: string,
  tableName: string
): Promise<TableSelect | undefined> =>
  await getDb()
    .selectFrom('snapshot_table')
    .where('schema_id', '=', schemaId)
    .where('name', '=', tableName)
    .selectAll()
    .executeTakeFirst()

export const getTableFromCurrentSnapshot = async (
  connectionId: string,
  databaseName: string,
  schemaName: string,
  tableName: string
): Promise<TableSelect | undefined> =>
  await getDb()
    .selectFrom('snapshot_table')
    .innerJoin(
      'snapshot_schema',
      'snapshot_table.schema_id',
      'snapshot_schema.id'
    )
    .innerJoin(
      'snapshot_database',
      'snapshot_schema.database_id',
      'snapshot_database.id'
    )
    .innerJoin('snapshot', 'snapshot_database.snapshot_id', 'snapshot.id')
    .where('snapshot.connection_id', '=', connectionId)
    .where('snapshot.status', '=', 'COMPLETED')
    .where('snapshot_database.name', '=', databaseName)
    .where('snapshot_schema.name', '=', schemaName)
    .where('snapshot_table.name', '=', tableName)
    .orderBy('snapshot.timestamp', 'desc')
    .limit(1)
    .selectAll('snapshot_table')
    .executeTakeFirst()

export const removeTable = async (id: string) => {
  await getDb().deleteFrom('snapshot_table').where('id', '=', id).execute()
}

/** @deprecated use insertTable instead */
export const insertTableOld = async (
  sortDb: Kysely<SortDB>,
  table: TableInsertWithRelations
): Promise<{ id: string }> => {
  const columns = table.insertColumns

  delete table.insertColumns

  const id = await sortDb
    .insertInto('snapshot_table')
    .values(table)
    .returning(['id'])
    .executeTakeFirstOrThrow()

  if (columns && columns.length) {
    for (const col of columns) {
      await insertColumn(sortDb, col)
    }
  }

  return id
}

export const getAllColumns = async (
  connectionId: string,
  databaseName: string,
  schemaName: string,
  tableName: string
): Promise<ColumnSelect[]> => {
  const table = await getTableFromCurrentSnapshot(
    connectionId,
    databaseName,
    schemaName,
    tableName
  )

  if (!table) {
    throw new MissingTableError(tableName)
  }

  return await getColumnsByTableId(table.id)
}
