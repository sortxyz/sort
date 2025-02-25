import { getConfig, logger } from '../../../..'
import * as DatabaseConstants from '../../../../constants/database.constant'
import * as Errors from '../../../../errors'
import { ResponseColumnTypesArray } from '../../../../schemas/response-column.schema'
import * as SharedUtils from '../../../../utils'
import { SqlValidationQueryService } from '../../validation/sql.service'

import { BaseSqlQueryService } from './base.service'

import type * as QueryExecutionSchema from '../../../../schemas/query-execution.schema'
import type { ResponseColumnTypes } from '../../../../schemas/response-column.schema'
import type * as ConnectionType from '../../../../types/kysely/connection/connection.type'
import type { FieldDef, Pool, PoolClient, QueryResult } from 'pg'

export class PostgresSqlQueryService extends BaseSqlQueryService {
  protected pgPool!: Pool

  private async createDatabase(
    readonlyConnection: ConnectionType.ConnectionSelectWithEncryption,
    database: string
  ) {
    const connectionString = SharedUtils.changeDatabaseOfConnectionString({
      connectionString: await readonlyConnection.connection_string.decrypt(),
      dbName: database,
      dataProvider: 'postgres'
    })

    this.pgPool = SharedUtils.createPg7Pool(
      connectionString,
      readonlyConnection.with_ssl,
      {
        connectionTimeoutMillis:
          getConfig().USER_FACING_EXTERNAL_DB_CONNECTION_TIMEOUT_MS,
        query_timeout: getConfig().CUSTOMER_QUERY_TIMEOUT_MS
      }
    )
  }

  /** Maps the `columnName` from an unknown schema to a column type we support. */
  protected getPostgresColumnType(
    dataTypeId: number | undefined,
    columnName: string | undefined
  ): ResponseColumnTypes | 'unknown' {
    if (dataTypeId === undefined) return 'unknown'

    for (const key of ResponseColumnTypesArray) {
      const types = DatabaseConstants.DataTypeIdToColumnTypeMappings[key]
      if (types.includes(dataTypeId)) {
        return key
      }
    }

    logger.debug(
      `Unknown column type for: ${columnName} with data type: ${dataTypeId} in ${this.connection.name}`
    )

    // default to unknown type
    return 'unknown'
  }

  protected getColumnsTypes(
    allFields: FieldDef[]
  ): QueryExecutionSchema.QueryColumn[] {
    const ret: QueryExecutionSchema.QueryColumn[] = []

    for (const field of allFields) {
      ret.push({
        name: field.name,
        type: this.getPostgresColumnType(field.dataTypeID, field.name)
      })
    }

    return ret
  }

  async destroyDatabase(): Promise<void> {
    if (this.pgPool) {
      return this.pgPool.end()
    }
    return Promise.resolve()
  }

  protected async executeSql(
    sqlQuery: string,
    readonlyConnection: ConnectionType.ConnectionSelectWithEncryption,
    database: string
  ): Promise<QueryExecutionSchema.QueryExecutionResponse> {
    await this.createDatabase(readonlyConnection, database)

    const start = performance.now()

    let poolClient: PoolClient | undefined

    const validator = new SqlValidationQueryService(
      readonlyConnection.id,
      'postgres',
      sqlQuery
    )
    const isValid = validator.validate()

    if (!isValid.is_sort_queryable) {
      const msg = `Query is not valid${
        isValid.error ? ': ' + isValid.error : '.'
      }`
      throw new Errors.SqlSyntaxError(msg, {
        cause: { message: isValid.error }
      })
    }

    try {
      poolClient = await this.pgPool.connect()

      const results = await poolClient.query(sqlQuery)

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const flattenedResult: QueryResult = Array.isArray(results)
        ? // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          results.find(r => r.command === 'SELECT')
        : results

      const columns = this.getColumnsTypes(flattenedResult.fields)
      const response = {
        columns,
        duration_ms: performance.now() - start,
        query: sqlQuery,
        records: this.mapRowsToRecords(
          flattenedResult.rows.slice(0, DatabaseConstants.DEFAULT_QUERY_LIMIT),
          columns.map(c => c.name)
        )
      } satisfies QueryExecutionSchema.QueryExecutionResponse

      return response
    } catch (error) {
      if ((error as Error).message === 'Query read timeout') {
        throw new Errors.QueryTimeoutError('Query read timeout', {
          cause: error
        })
      } else {
        throw error
      }
    } finally {
      if (poolClient) {
        poolClient.release()
      }
      await this.destroyDatabase()
    }
  }
}
