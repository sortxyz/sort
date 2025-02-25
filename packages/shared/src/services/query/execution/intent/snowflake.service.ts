import { Kysely, PostgresDialect, sql } from 'kysely'
import { Pool } from 'pg'

import * as SharedUtils from '../../../../utils'
import { snowflakeColumnTypeMapper } from '../../../../utils/col-mapper.util'
import { SnowflakeService } from '../../../customer-connection/snowflake.service'

import { BaseIntentQueryService } from './base.service'

import type * as QueryExecutionSchema from '../../../../schemas/query-execution.schema'
import type { ResponseColumnTypes } from '../../../../schemas/response-column.schema'

export class SnowflakeIntentQueryService extends BaseIntentQueryService {
  protected kysely!: Kysely<unknown>
  protected snowflakeSvc!: SnowflakeService

  private async createResources() {
    if (this.kysely || this.snowflakeSvc) {
      await this.destroyResources()
    }

    this.snowflakeSvc = new SnowflakeService({
      ...this.connection,
      connection_string: await this.connection.connection_string.decrypt()
    })

    if (!this.connection.warehouse) {
      // this should have gotten a warehouse during schema import
      throw new Error(`No default warehouse saved for ${this.connection.id}`)
    }

    await this.snowflakeSvc.createPool({ warehouse: this.connection.warehouse })

    this.kysely = new Kysely({
      // We pass the Postgres dialect for compilation of Snowflake queries,
      // not execution (querying the provider)
      //
      // Postgres and Snowflake's dialects overlap for the subset of queries we're
      // going to build for intent queries. (SQL 99, 2003) Because we have
      // a limited set of actions we allow the user to take
      // and know the scope (eg. SELECT * FROM tbl WHERE LIMIT) in which thery use them,
      // we can use Postgres to compile Snowflake queries.
      //
      // PG ref: https://postgres.cz/wiki/Introduction_to_PostgreSQL_SQL#:~:text=PostgreSQL%20supports%20completely%20ANSI%20SQL%3A1999%20and%20partly%20ANSI%3A2003.
      // Snowflake ref: https://postgres.cz/wiki/Introduction_to_PostgreSQL_SQL#:~:text=PostgreSQL%20supports%20completely%20ANSI%20SQL%3A1999%20and%20partly%20ANSI%3A2003.

      dialect: new PostgresDialect({
        pool: async () =>
          new Pool({
            database: 'some_db',
            host: 'localhost'
          })
      })
    })

    return this.kysely
  }

  private async destroyResources(): Promise<void> {
    if (this.kysely) {
      await this.kysely.destroy()
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      this.kysely = undefined as any
    }

    if (this.snowflakeSvc) {
      await this.snowflakeSvc.closePool()
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      this.snowflakeSvc = undefined as any
    }
  }

  protected getColumnType(
    columnType: string | undefined
  ): ResponseColumnTypes | 'unknown' {
    return snowflakeColumnTypeMapper(this.connection, columnType)
  }

  protected async executeIntent(
    database: string,
    intent: QueryExecutionSchema.IntentQuery
  ): Promise<QueryExecutionSchema.QueryExecutionResponse> {
    await this.createResources()

    const allColumns = await this.getAllColumns(database, intent)

    // columns: [ '*' ] is all columns
    const columns =
      intent.columns.length === 1 && intent.columns[0] === '*'
        ? allColumns.map(c => c.name)
        : intent.columns

    const cols = sql.join(columns.map(c => sql.id(c)))
    const where = this.createWhereClause(intent)
    const orderBy = this.createOrderByClause(intent)

    const queryBuilder = sql`
      ${sql.raw(intent.dml.toUpperCase())}
        ${cols}
      FROM
        ${sql.id(database, intent.schema, intent.table)}
      ${where}
      ${orderBy}
      LIMIT ${sql.val(intent.limit)}`

    const start = performance.now()

    try {
      const compiled = queryBuilder.compile(this.kysely)

      // snowflake SQL uses :1, :2, etc. for parameters instead of $1, $2, etc.
      // these tokens are replaced with `binds` when the query is executed
      const sql = compiled.sql.replaceAll('$', ':')
      const stringParams = compiled.parameters.map(p => p as string)

      const results = await SharedUtils.SnowflakeUtils.runQuery<unknown>({
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        snowflakePool: this.snowflakeSvc.pool!,
        sqlText: sql,
        binds: stringParams
      })

      const response: QueryExecutionSchema.QueryExecutionResponse = {
        columns: this.getColumnsTypes(allColumns, columns),
        duration_ms: performance.now() - start,
        query: compiled.sql,
        records: this.mapRowsToRecords(results, columns)
      }

      return response
    } finally {
      await this.destroyResources()
    }
  }
}
