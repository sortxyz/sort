import { Kysely, PostgresDialect, sql } from 'kysely'

import { getConfig } from '../../../..'
import * as Errors from '../../../../errors'
import * as SharedUtils from '../../../../utils'
import { postgresColumnTypeMapper } from '../../../../utils/col-mapper.util'

import { BaseIntentQueryService } from './base.service'

import type * as QueryExecutionSchema from '../../../../schemas/query-execution.schema'
import type { ResponseColumnTypes } from '../../../../schemas/response-column.schema'
import type { Pool } from 'pg'

export class PostgresIntentQueryService extends BaseIntentQueryService {
  protected kysely!: Kysely<unknown>
  protected pgPool!: Pool

  private async createKysely(database: string) {
    if (this.kysely) {
      await this.destroyKysely()
    }

    const connectionString = SharedUtils.changeDatabaseOfConnectionString({
      connectionString: await this.connection.connection_string.decrypt(),
      dbName: database,
      dataProvider: 'postgres'
    })

    this.pgPool = SharedUtils.createPg7Pool(
      connectionString,
      this.connection.with_ssl,
      {
        connectionTimeoutMillis:
          getConfig().USER_FACING_EXTERNAL_DB_CONNECTION_TIMEOUT_MS,
        query_timeout: getConfig().CUSTOMER_QUERY_TIMEOUT_MS
      }
    )

    this.kysely = new Kysely({
      dialect: new PostgresDialect({
        pool: this.pgPool
      })
    })

    return this.kysely
  }

  private async destroyKysely(): Promise<void> {
    if (this.kysely) {
      await this.kysely.destroy()
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      this.kysely = undefined as any
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      this.pgPool = undefined as any
    }
  }

  protected getColumnType(
    columnType: string | undefined
  ): ResponseColumnTypes | 'unknown' {
    return postgresColumnTypeMapper(this.connection, columnType)
  }

  /**
   * Executes the intent query against the database. Note: this destroys the resources for this provider after the query is executed.
   * @param database - string name of the database
   * @param intent
   * @returns
   */
  protected async executeIntent(
    database: string,
    intent: QueryExecutionSchema.IntentQuery
  ): Promise<QueryExecutionSchema.QueryExecutionResponse> {
    await this.createKysely(database)

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
        ${sql.id(intent.schema, intent.table)}
      ${where}
      ${orderBy}
      LIMIT ${sql.val(intent.limit)}`

    const start = performance.now()

    try {
      const result =
        await sql<QueryExecutionSchema.QueryRecord>`${queryBuilder}`.execute(
          this.kysely
        )

      const compiled = queryBuilder.compile(this.kysely)

      const response: QueryExecutionSchema.QueryExecutionResponse = {
        columns: this.getColumnsTypes(allColumns, columns),
        duration_ms: performance.now() - start,
        query: compiled.sql,
        records: this.mapRowsToRecords(result.rows, columns)
      }

      return response
    } catch (error) {
      const msg = (error as Error).message
      if (msg === 'Query read timeout') {
        throw new Errors.QueryTimeoutError('Query read timeout', {
          cause: error
        })
      } else if (msg === 'Connection terminated due to connection timeout') {
        throw new Errors.DatabaseConnectionTimeoutError(
          'Database connection timeout',
          {
            cause: error
          }
        )
      } else {
        throw error
      }
    } finally {
      await this.destroyKysely()
    }
  }
}
