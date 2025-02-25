import { getDb } from '../../../'

import type {
  TableInsert,
  TableSelect
} from '../../../types/kysely/metadata/table.type'
import type { DeleteResult } from 'kysely'

export const insertTable = async (
  table: TableInsert
): Promise<{
  connection_id: string
  raw_name: string
  raw_schema_name: string
  raw_database_name: string
}> =>
  await getDb()
    .insertInto('metadata_table')
    .values(table)
    .returning([
      'connection_id',
      'raw_name',
      'raw_schema_name',
      'raw_database_name'
    ])
    .executeTakeFirstOrThrow()

export const getTable = async (
  connection_id: string,
  raw_name: string,
  raw_schema_name: string,
  raw_database_name: string
): Promise<TableSelect | undefined> =>
  await getDb()
    .selectFrom('metadata_table')
    .where('raw_name', '=', raw_name)
    .where('raw_database_name', '=', raw_database_name)
    .where('raw_schema_name', '=', raw_schema_name)
    .where('connection_id', '=', connection_id)
    .limit(1)
    .selectAll()
    .executeTakeFirst()

export const removeTable = async (
  connection_id: string,
  raw_name: string,
  raw_schema_name: string,
  raw_database_name: string
): Promise<DeleteResult> =>
  await getDb()
    .deleteFrom('metadata_table')
    .where('raw_name', '=', raw_name)
    .where('raw_database_name', '=', raw_database_name)
    .where('raw_schema_name', '=', raw_schema_name)
    .where('connection_id', '=', connection_id)
    .executeTakeFirst()

/** Fetch all tables with a matching raw_name */
export const getTables = async (
  table_names: string[],
  raw_schema_name: string,
  raw_database_name: string,
  connection_id: string
) => {
  return await createGetTablesQuery(
    table_names,
    raw_schema_name,
    raw_database_name,
    connection_id
  )
    .selectAll()
    .execute()
}

export const createGetTablesQuery = (
  table_names: string[],
  raw_schema_name: string,
  raw_database_name: string,
  connection_id: string
) => {
  return getDb()
    .selectFrom('metadata_table')
    .where('raw_name', 'in', table_names)
    .where('raw_database_name', '=', raw_database_name)
    .where('raw_schema_name', '=', raw_schema_name)
    .where('connection_id', '=', connection_id)
}
