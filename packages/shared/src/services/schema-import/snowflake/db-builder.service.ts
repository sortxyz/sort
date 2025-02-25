import { randomUUID } from 'crypto'

import * as DatabaseConstants from '../../../constants/database.constant'
import { SnowflakeUtils } from '../../../utils'

import type { ColumnInsert } from '../../../types/kysely/snapshot/column.type'
import type { DatabaseInsertWithRelations } from '../../../types/kysely/snapshot/database.type'
import type { SchemaInsertWithRelations } from '../../../types/kysely/snapshot/schema.type'
import type { TableInsertWithRelations } from '../../../types/kysely/snapshot/table.type'
import type { SnowflakeService } from '../../customer-connection/snowflake.service'
import type { BaseDatabaseBuilderService } from '../schema-import.base.service'

// from: https://docs.snowflake.com/en/sql-reference/sql/show-columns#output
export type SnowflakeShowColumnRow = {
  column_name: string
  data_type: string
  schema_name: string
  table_name: string

  // we use these columns to pass information through
  default: string
  is_view?: boolean
  'null?': string
  is_primary_key?: boolean
}

export type SnowflakeShowViewsRow = {
  name: string
  schema_name: string
}

export type SnowflakeShowPrimaryKeysRow = {
  column_name: string
  schema_name: string
  table_name: string
}

export type SnowflakeShowHybridTablesRow = {
  name: string
  database_name: string
  schema_name: string
}

export class SnowflakeDatabaseBuilder implements BaseDatabaseBuilderService {
  constructor(protected snowflakeSvc: SnowflakeService) {}

  static inferDataType(datatype: string): string {
    // datatype is typically a form like:
    // {"type":"FIXED","precision":38,"scale":0,"nullable":true}
    // ref: https://docs.snowflake.com/en/sql-reference/sql/show-columns#examples

    if (datatype === undefined) {
      return 'unknown'
    }

    let parsedType: { type: string } = { type: 'unknown' }
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      parsedType = JSON.parse(datatype)
    } catch {
      return 'unknown'
    }

    // we should have one of these now: https://docs.snowflake.com/en/sql-reference/intro-summary-data-types
    return parsedType.type
  }

  private processColumns(
    rawColumnsInDb: SnowflakeShowColumnRow[],
    tableId: string,
    schemaName: string,
    tableName: string
  ): ColumnInsert[] {
    const columnsInTableSchema = rawColumnsInDb.filter(
      n => n.schema_name === schemaName && n.table_name === tableName
    )

    if (!columnsInTableSchema || !columnsInTableSchema.length) {
      return []
    }

    const cols: ColumnInsert[] = []
    for (const col of columnsInTableSchema) {
      if (col.column_name === undefined) {
        continue
      }

      const dataType = SnowflakeDatabaseBuilder.inferDataType(col.data_type)

      cols.push({
        id: randomUUID(),
        name: col.column_name,
        table_id: tableId,
        type: dataType,
        nullable: col['null?'] === 'true',
        position: columnsInTableSchema.indexOf(col),
        is_primary_key: col.is_primary_key ?? false,
        has_default: col.default !== undefined
      } satisfies ColumnInsert)
    }

    return cols
  }

  private processTablesOrViews(
    rawColumnsInDb: SnowflakeShowColumnRow[],
    schemaId: string,
    schemaName: string
  ): TableInsertWithRelations[] {
    const tablesInSchema = rawColumnsInDb
      .filter(n => n.schema_name === schemaName)
      .map(n => n.table_name)

    if (!tablesInSchema?.length) {
      return []
    }

    const tableInserts: TableInsertWithRelations[] = []
    const tables = [...new Set(tablesInSchema)]

    for (const tbl of tables) {
      const isView = rawColumnsInDb.some(
        col => col.table_name === tbl && col.is_view
      )
      const tableId = randomUUID()
      tableInserts.push({
        id: tableId,
        name: tbl,
        is_view: isView,
        schema_id: schemaId,
        insertColumns: this.processColumns(
          rawColumnsInDb,
          tableId,
          schemaName,
          tbl
        )
      })
    }

    return tableInserts
  }

  private processSchemas(
    rawColumnsInDb: SnowflakeShowColumnRow[],
    databaseId: string
  ): SchemaInsertWithRelations[] {
    const schemasInDb: string[] = rawColumnsInDb
      .filter(
        n =>
          !DatabaseConstants.SNOWFLAKE_EXCLUDED_SCHEMAS.includes(n.schema_name)
      )
      .map(n => n.schema_name)

    if (!schemasInDb?.length) {
      return []
    }

    const schemas = [...new Set(schemasInDb)]

    const schemaInserts: SchemaInsertWithRelations[] = []
    for (const sc of schemas) {
      const schemaId = randomUUID()
      const insertTables = this.processTablesOrViews(
        rawColumnsInDb,
        schemaId,
        sc
      )

      // ignore schemas with 0 tables
      if (!insertTables?.length) {
        continue
      }

      schemaInserts.push({
        id: schemaId,
        name: sc,
        database_id: databaseId,
        insertTables
      })
    }

    return schemaInserts
  }

  public async processDb(
    snapshotId: string,
    dbName: string
  ): Promise<DatabaseInsertWithRelations | null> {
    try {
      await this.snowflakeSvc.createPool()

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const snowflakePool = this.snowflakeSvc.pool!
      const databaseId = randomUUID()

      // retrieve all columns in DB
      // https://docs.snowflake.com/en/sql-reference/sql/show-columns.html
      const rawColumnsInDb =
        await SnowflakeUtils.runQuery<SnowflakeShowColumnRow>({
          snowflakePool,
          sqlText: `SHOW COLUMNS IN DATABASE ${dbName}`
        })

      // add our views
      // https://docs.snowflake.com/en/sql-reference/sql/show-views
      const rawViewsInDb = await SnowflakeUtils.runQuery<SnowflakeShowViewsRow>(
        {
          snowflakePool,
          sqlText: `SHOW VIEWS IN DATABASE ${dbName}`
        }
      )

      const hybridTables =
        await SnowflakeUtils.runQuery<SnowflakeShowHybridTablesRow>({
          snowflakePool,
          sqlText: `SHOW HYBRID TABLES IN DATABASE ${dbName}`
        })

      const allPrimaryKeys =
        await SnowflakeUtils.runQuery<SnowflakeShowPrimaryKeysRow>({
          snowflakePool,
          sqlText: `SHOW PRIMARY KEYS IN DATABASE ${dbName}`
        })

      // We only care about primary keys on hybrid tables b/c those are the only
      // primary keys snowflake enforces.
      const primaryKeys = allPrimaryKeys.filter(pk => {
        return hybridTables.some(
          tbl =>
            tbl.name === pk.table_name && tbl.schema_name === pk.schema_name
        )
      })

      const columnsPlusMetadata = rawColumnsInDb.map(col => {
        return {
          ...col,
          is_view: rawViewsInDb.some(vw => vw.name === col.table_name),
          is_primary_key: primaryKeys.some(
            pk =>
              pk.table_name === col.table_name &&
              pk.schema_name === col.schema_name &&
              pk.column_name === col.column_name
          )
        }
      })

      const schemas = this.processSchemas(columnsPlusMetadata, databaseId)

      const createDb = {
        id: databaseId,
        name: dbName,
        insertSchemas: schemas,
        snapshot_id: snapshotId
      } satisfies DatabaseInsertWithRelations

      return createDb
    } finally {
      await this.snowflakeSvc.closePool()
    }
  }
}
