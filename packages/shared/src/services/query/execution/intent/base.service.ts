import { sql } from 'kysely'

import { getAllColumns } from '../../../kysely/snapshot/table.service'
import { BaseQueryService } from '../base'

import type * as QueryExecutionSchema from '../../../../schemas/query-execution.schema'
import type { ResponseColumnTypes } from '../../../../schemas/response-column.schema'
import type * as ConnectionType from '../../../../types/kysely/connection/connection.type'
import type { ColumnSelect } from '../../../../types/kysely/snapshot/column.type'

export abstract class BaseIntentQueryService extends BaseQueryService {
  constructor(
    protected readonly connection: ConnectionType.ConnectionSelectWithEncryption
  ) {
    switch (connection.data_provider) {
      case 'postgres':
      case 'snowflake':
        break
      default:
        throw new Error('Invalid data provider')
    }
    super()
  }

  protected async getAllColumns(
    database: string,
    intent: QueryExecutionSchema.IntentQuery
  ): Promise<ColumnSelect[]> {
    return await getAllColumns(
      this.connection.id,
      database,
      intent.schema,
      intent.table
    )
  }

  protected abstract getColumnType(
    columnType: string | undefined
  ): ResponseColumnTypes | 'unknown'

  protected getColumnsTypes(
    allColumns: ColumnSelect[],
    columns: string[]
  ): QueryExecutionSchema.QueryColumn[] {
    const ret: QueryExecutionSchema.QueryColumn[] = []

    for (const columnName of columns) {
      const col = allColumns.find(c => c.name === columnName)

      ret.push({
        name: columnName,
        type: this.getColumnType(col?.type)
      })
    }

    return ret
  }

  protected createWhereClause(intent: QueryExecutionSchema.IntentQuery) {
    const wheres = intent.filters.map(f => {
      return sql`${sql.id(f.column)} ${sql.raw(f.op)} ${sql.val(f.value)}`
    })

    const combinedWheres = wheres.length
      ? sql.join(wheres, sql` ${sql.raw(intent.combinator)} `)
      : sql.raw('')

    const where = wheres.length ? sql` WHERE ${combinedWheres}` : sql.raw('')

    return where
  }

  protected createOrderByClause(intent: QueryExecutionSchema.IntentQuery) {
    const orders = intent.orders.map(o => {
      return sql`${sql.id(o.column)} ${sql.raw(o.direction)}`
    })

    const combinedOrders = orders.length ? sql.join(orders) : sql.raw('')

    const orderBy = orders.length
      ? sql` ORDER BY\n${combinedOrders}`
      : sql.raw('')

    return orderBy
  }

  protected abstract executeIntent(
    database: string,
    intent: QueryExecutionSchema.IntentQuery
  ): Promise<QueryExecutionSchema.QueryExecutionResponse>

  public async execute(
    database: string,
    query: QueryExecutionSchema.Query
  ): Promise<QueryExecutionSchema.QueryExecutionResponse> {
    if (query.type !== 'intent') {
      throw new Error('Invalid query type')
    }

    return this.executeIntent(database, query.intent)
  }
}
