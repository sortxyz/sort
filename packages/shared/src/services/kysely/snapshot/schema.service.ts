import { getDb } from '../../../'
import { getColumnTypeMapper } from '../../query/column-type.util'

import { insertTable, insertTableOld } from './table.service'

import type { FullSchema, FullSchemaOld } from '../../../schemas/schema.schema'
import type { ConnectionSelectWithEncryption } from '../../../types/kysely/connection/connection.type'
import type {
  SchemaInsertWithRelations,
  SchemaSelect
} from '../../../types/kysely/snapshot/schema.type'
import type { SortDB } from '../../../types/kysely.type'
import type { Kysely } from 'kysely'

export const insertSchema = async (
  sortDb: Kysely<SortDB>,
  connectionId: string,
  databaseName: string,
  schema: SchemaInsertWithRelations
): Promise<{ id: string }> => {
  const tables = schema.insertTables

  delete schema.insertTables

  const id = await sortDb
    .insertInto('snapshot_schema')
    .values(schema)
    .returning(['id'])
    .executeTakeFirstOrThrow()

  if (tables && tables.length) {
    for (const tbl of tables) {
      await insertTable(sortDb, connectionId, databaseName, schema.name, tbl)
    }
  }

  return id
}

/** @deprecated Use insertSchema instead */
export const insertSchemaOld = async (
  sortDb: Kysely<SortDB>,
  schema: SchemaInsertWithRelations
): Promise<{ id: string }> => {
  const tables = schema.insertTables

  delete schema.insertTables

  const id = await sortDb
    .insertInto('snapshot_schema')
    .values(schema)
    .returning(['id'])
    .executeTakeFirstOrThrow()

  if (tables && tables.length) {
    for (const tbl of tables) {
      await insertTableOld(sortDb, tbl)
    }
  }

  return id
}

export const getSchema = async (
  id: string
): Promise<SchemaSelect | undefined> =>
  await getDb()
    .selectFrom('snapshot_schema')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()

export const getSchemaByName = async (
  databaseId: string,
  name: string
): Promise<SchemaSelect | undefined> =>
  await getDb()
    .selectFrom('snapshot_schema')
    .where('database_id', '=', databaseId)
    .where('name', '=', name)
    .selectAll()
    .executeTakeFirst()

/**
 * Retreive the full schema of a database including all tables and columns.
 */
export const getFullSchema = async ({
  connection,
  databaseId,
  schemaName,
  tableName
}: {
  connection: ConnectionSelectWithEncryption
  databaseId: string
  schemaName?: string
  tableName?: string
}) => {
  const rows = await getFullSchemaRows({ databaseId, schemaName, tableName })
  const aggregate = aggregateFullSchema(connection, rows)
  return aggregate
}

export const getFullSchemaRows = async ({
  databaseId,
  schemaName,
  tableName
}: {
  databaseId: string
  schemaName?: string
  tableName?: string
}) => {
  let builder = getDb()
    .selectFrom('snapshot_schema as ss')
    .innerJoin('snapshot_table as st', 'st.schema_id', 'ss.id')
    .innerJoin('snapshot_column as sc', 'sc.table_id', 'st.id')
    .select([
      'ss.id as schema_id',
      'ss.name as schema_name',
      'st.id as table_id',
      'st.name as table_name',
      'sc.name as column_name',
      'sc.type as column_type',
      'sc.nullable as nullable',
      'sc.is_primary_key as is_primary_key',
      'sc.has_default as has_default'
    ])
    .where('ss.database_id', '=', databaseId)

  if (schemaName) {
    builder = builder.where('ss.name', '=', schemaName)
  }

  if (tableName) {
    builder = builder.where('st.name', '=', tableName)
  }

  return await builder.limit(5000).execute()
}

const aggregateFullSchema = (
  connection: ConnectionSelectWithEncryption,
  schemaRows: Awaited<ReturnType<typeof getFullSchemaRows>>
) => {
  const accumulator: Record<string, FullSchema> = {}
  const mapType = getColumnTypeMapper(connection)

  const schemas = schemaRows.reduce((val, row) => {
    const schema = val[row.schema_id]
    if (!schema) {
      val[row.schema_id] = {
        id: row.schema_id,
        name: row.schema_name,
        tables: [
          {
            id: row.table_id,
            name: row.table_name,
            columns: [
              {
                name: row.column_name,
                nullable: row.nullable,
                type: mapType(connection, row.column_type),
                is_primary_key: row.is_primary_key,
                has_default: row.has_default ?? false
              }
            ]
          }
        ]
      }
      return val
    }

    const table = schema.tables.find(t => t.id === row.table_id)
    if (!table) {
      schema.tables.push({
        id: row.table_id,
        name: row.table_name,
        columns: [
          {
            name: row.column_name,
            nullable: row.nullable,
            type: mapType(connection, row.column_type),
            is_primary_key: row.is_primary_key,
            has_default: row.has_default ?? false
          }
        ]
      })
      return val
    }

    table.columns.push({
      name: row.column_name,
      nullable: row.nullable,
      type: mapType(connection, row.column_type),
      is_primary_key: row.is_primary_key,
      has_default: row.has_default ?? false
    })

    return val
  }, accumulator)

  return Object.values(schemas)
}

export const removeSchema = async (id: string) => {
  await getDb().deleteFrom('snapshot_schema').where('id', '=', id).execute()
}

/** @deprecated Use getFullSchema instead */
export const getFullSchemaOld = async (databaseId: string) => {
  const rows = await getFullSchemaRowsOld(databaseId)
  return aggregateFullSchemaOld(rows)
}

/** @deprecated Use getFullSchemaRows instead */
export const getFullSchemaRowsOld = async (databaseId: string) => {
  return await getDb()
    .selectFrom('snapshot_schema as ss')
    .innerJoin('snapshot_table as st', 'st.schema_id', 'ss.id')
    .innerJoin('snapshot_column as sc', 'sc.table_id', 'st.id')
    .select([
      'ss.id as schema_id',
      'ss.name as schema_name',
      'st.id as table_id',
      'st.name as table_name',
      'sc.name as column_name'
    ])
    .where('ss.database_id', '=', databaseId)
    .limit(5000)
    .execute()
}

/** @deprecated Use aggregateFullSchema instead */
const aggregateFullSchemaOld = (
  schemaRows: Awaited<ReturnType<typeof getFullSchemaRowsOld>>
) => {
  const accumulator: Record<string, FullSchemaOld> = {}

  const schemas = schemaRows.reduce((val, row) => {
    const schema = val[row.schema_id]
    if (!schema) {
      val[row.schema_id] = {
        id: row.schema_id,
        name: row.schema_name,
        tables: [
          {
            id: row.table_id,
            name: row.table_name,
            columns: [
              {
                name: row.column_name
              }
            ]
          }
        ]
      }
      return val
    }

    const table = schema.tables.find(t => t.id === row.table_id)
    if (!table) {
      schema.tables.push({
        id: row.table_id,
        name: row.table_name,
        columns: [
          {
            name: row.column_name
          }
        ]
      })
      return val
    }

    table.columns.push({
      name: row.column_name
    })

    return val
  }, accumulator)

  return Object.values(schemas)
}
