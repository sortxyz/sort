import { randomUUID } from 'crypto'

import { Kysely, PostgresDialect, sql } from 'kysely'

import { PG7_EXCLUDED_SCHEMAS } from '../../../constants/database.constant'
import * as ConnectionUtils from '../../../utils/connection.util'

import type { ColumnInsert } from '../../../types/kysely/snapshot/column.type'
import type { DatabaseInsertWithRelations } from '../../../types/kysely/snapshot/database.type'
import type { SchemaInsertWithRelations } from '../../../types/kysely/snapshot/schema.type'
import type { TableInsertWithRelations } from '../../../types/kysely/snapshot/table.type'
import type { BaseDatabaseBuilderService } from '../schema-import.base.service'
import type { ColumnMetadata } from 'kysely'
import type { Pool } from 'pg'

export type PrimaryKeyQuery = { table_name: string; column_name: string }

export class PostgresDatabaseBuilder implements BaseDatabaseBuilderService {
  protected kysely: Kysely<unknown> | undefined
  protected pgPool: Pool | undefined

  constructor(
    protected connectionString: string,
    protected withSsl: boolean
  ) {}

  private async processTables(
    schemaId: string,
    schemaName: string,
    primaryKeys: PrimaryKeyQuery[]
  ): Promise<TableInsertWithRelations[]> {
    const tables = await this.kysely!.introspection.getTables()

    const allTables = tables
      .filter(n => n.schema === schemaName)
      .map(n => {
        const tableId = randomUUID()
        const primaryKeysForTable = primaryKeys.filter(
          pk => pk.table_name === n.name
        )
        return {
          id: tableId,
          name: n.name,
          is_view: false,
          schema_id: schemaId,
          insertColumns: this.processColumns(
            tableId,
            n.columns,
            primaryKeysForTable
          )
        } satisfies TableInsertWithRelations
      })

    return allTables
  }

  private processColumns(
    tableId: string,
    columns: ColumnMetadata[],
    primaryKeys: PrimaryKeyQuery[]
  ): ColumnInsert[] {
    const cols = columns.map(
      n =>
        ({
          id: randomUUID(),
          name: n.name,
          table_id: tableId,
          type: n.dataType,
          nullable: n.isNullable,
          is_primary_key: primaryKeys.some(pk => pk.column_name === n.name),
          has_default: n.hasDefaultValue,
          position: columns.indexOf(n)
        }) satisfies ColumnInsert
    )

    return cols
  }

  private async processSchemas(
    databaseId: string
  ): Promise<SchemaInsertWithRelations[]> {
    const schemas = await this.kysely!.introspection.getSchemas()

    const allSchemas: SchemaInsertWithRelations[] = []
    for (const sc of schemas) {
      const schemaId = randomUUID()

      const primaryKeys = await this.getPrimaryKeys(sc.name)
      const insertTables = await this.processTables(
        schemaId,
        sc.name,
        primaryKeys
      )

      // ignore schemas with 0 tables
      if (!insertTables?.length) {
        continue
      }

      allSchemas.push({
        id: schemaId,
        name: sc.name,
        database_id: databaseId,
        insertTables
      })
    }

    return allSchemas.filter(n => !PG7_EXCLUDED_SCHEMAS.includes(n.name))
  }

  private createKyselyResources(dbName: string) {
    const connectionStringWithDb =
      ConnectionUtils.changeDatabaseOfConnectionString({
        connectionString: this.connectionString,
        dbName,
        dataProvider: 'postgres'
      })

    this.pgPool = ConnectionUtils.createPg7Pool(
      connectionStringWithDb,
      this.withSsl
    )

    this.kysely = new Kysely({
      dialect: new PostgresDialect({
        pool: this.pgPool
      })
    })
  }

  private async disconnectKysely(): Promise<void> {
    if (this.kysely) {
      await this.kysely.destroy()
      this.kysely = undefined
      this.pgPool = undefined
    }
  }

  private async getPrimaryKeys(schemaName: string) {
    try {
      const result = await sql<{ table_name: string; column_name: string }>`
        SELECT
          c.relname AS table_name,
          a.attname AS column_name
        FROM
          pg_constraint AS con
          INNER JOIN pg_class AS c ON c.oid = con.conrelid
          INNER JOIN pg_namespace AS ns ON ns.oid = c.relnamespace
          INNER JOIN pg_attribute AS a ON a.attnum = ANY(con.conkey)
            AND a.attrelid = con.conrelid
        WHERE
          con.contype = 'p' -- primary key
          AND ns.nspname = ${schemaName}
      `.execute(this.kysely!)

      return result?.rows || []
    } catch (err) {
      throw new Error(`Failed to get primary keys for schema ${schemaName}`, {
        cause: err
      })
    }
  }

  private async canConnect() {
    try {
      await sql`select datname from pg_catalog.pg_database limit 1`.execute(
        this.kysely!
      )
      return true
    } catch (err) {
      return false
    }
  }

  public async processDb(
    snapshotId: string,
    dbName: string
  ): Promise<DatabaseInsertWithRelations | null> {
    this.createKyselyResources(dbName)

    if (!(await this.canConnect())) {
      await this.disconnectKysely()
      return null
    }

    try {
      const databaseId = randomUUID()
      const schemas = await this.processSchemas(databaseId)

      const createDb = {
        id: databaseId,
        name: dbName,
        insertSchemas: schemas,
        snapshot_id: snapshotId
      } satisfies DatabaseInsertWithRelations

      return createDb
    } finally {
      await this.disconnectKysely()
    }
  }
}
