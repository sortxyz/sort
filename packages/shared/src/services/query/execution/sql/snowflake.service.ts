import { logger } from '../../../..'
import * as DatabaseConstants from '../../../../constants/database.constant'
import * as Errors from '../../../../errors'
import * as SharedUtils from '../../../../utils'
import { SnowflakeService } from '../../../customer-connection/snowflake.service'
import { SqlValidationQueryService } from '../../validation/sql.service'

import { BaseSqlQueryService } from './base.service'

import type {
  QueryColumn,
  QueryExecutionResponse
} from '../../../../schemas/query-execution.schema'
import type { ResponseColumnTypes } from '../../../../schemas/response-column.schema'
import type * as ConnectionType from '../../../../types/kysely/connection/connection.type'
import type { Pool } from 'generic-pool'
import type * as snowflake from 'snowflake-sdk'

export class SnowflakeSqlQueryService extends BaseSqlQueryService {
  protected snowflakeSvc!: SnowflakeService

  private async createResources(
    readonlyConnection: ConnectionType.ConnectionSelectWithEncryption
  ) {
    if (this.snowflakeSvc) {
      return
    }

    this.snowflakeSvc = new SnowflakeService({
      ...readonlyConnection,
      connection_string: await this.connection.connection_string.decrypt()
    })
  }

  private async createPool(
    readonlyConnection: ConnectionType.ConnectionSelectWithEncryption,
    database: string
  ): Promise<Pool<snowflake.Connection>> {
    if (!readonlyConnection.warehouse) {
      // this should have gotten a warehouse during schema import
      throw new Error(`No default warehouse saved for ${this.connection.id}`)
    }

    return await this.snowflakeSvc.createPool({
      warehouse: readonlyConnection.warehouse,
      database
    })
  }

  private async destroyResources(): Promise<void> {
    if (this.snowflakeSvc) {
      await this.snowflakeSvc.closePool()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
      this.snowflakeSvc = undefined as any
    }
  }

  /** Maps an unknown `columnValue` to a column type we support. */
  protected getColumnType(
    columnValue: unknown
  ): ResponseColumnTypes | 'unknown' {
    if (columnValue === undefined) return 'unknown'

    switch (typeof columnValue) {
      case 'boolean':
        return 'boolean'
      case 'number':
        return 'numeric'
      case 'string':
        return 'string'
      case 'object':
        if (columnValue instanceof Date) {
          return 'date'
        }
    }

    let debugValue = '<UNKNOWN>'
    try {
      debugValue = JSON.stringify(columnValue)
    } catch (e) {
      debugValue = String(columnValue)
    }
    logger.debug(`Unknown column type: ${debugValue} in ${this.connection.id}`)

    // default to unknown type
    return 'unknown'
  }

  protected getColumnsTypes(allRows: unknown[]): QueryColumn[] {
    const ret: QueryColumn[] = []

    if (!allRows.length) {
      return ret
    }

    // we have to infer the column types from the first row's values
    // more on the Snowflake types: https://docs.snowflake.com/en/developer-guide/node-js/nodejs-driver-consume#data-type-casting

    const firstRow = allRows[0] as Record<string, unknown>
    const allKeys = Object.keys(firstRow)

    for (const columnName of allKeys) {
      ret.push({
        name: columnName,
        type: this.getColumnType(firstRow[columnName])
      })
    }

    return ret
  }

  protected async executeSql(
    sqlQuery: string,
    readonlyConnection: ConnectionType.ConnectionSelectWithEncryption,
    database: string
  ): Promise<QueryExecutionResponse> {
    await this.createResources(readonlyConnection)

    const start = performance.now()

    let poolClient: Pool<snowflake.Connection> | undefined

    const validator = new SqlValidationQueryService(
      readonlyConnection.id,
      'postgres',
      sqlQuery
    )
    const isValid = validator.validate()

    if (!isValid.is_sort_queryable) {
      throw new Errors.SqlSyntaxError(isValid.error || 'Query is not valid')
    }

    try {
      poolClient = await this.createPool(readonlyConnection, database)

      const results = await SharedUtils.SnowflakeUtils.runQuery<unknown>({
        snowflakePool: poolClient,
        sqlText: sqlQuery,
        // works around: https://docs.snowflake.com/en/developer-guide/node-js/nodejs-driver-consume#returning-result-sets-that-contain-duplicate-column-names
        rowMode: 'object_with_renamed_duplicated_columns'
      })

      const columns = this.getColumnsTypes(results)
      const response = {
        columns,
        duration_ms: performance.now() - start,
        query: sqlQuery,
        records: this.mapRowsToRecords(
          results.slice(0, DatabaseConstants.DEFAULT_QUERY_LIMIT),
          columns.map(c => c.name)
        )
      } satisfies QueryExecutionResponse

      return response
    } finally {
      await this.destroyResources()
    }
  }
}
