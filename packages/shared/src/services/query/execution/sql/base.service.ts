import * as Errors from '../../../../errors'
import * as ConnectionService from '../../../connection.service'
import { BaseQueryService } from '../base'

import type * as QueryExecutionSchema from '../../../../schemas/query-execution.schema'
import type * as ConnectionType from '../../../../types/kysely/connection/connection.type'

export abstract class BaseSqlQueryService extends BaseQueryService {
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

  protected abstract executeSql(
    sqlQuery: string,
    readonlyConnection: ConnectionType.ConnectionSelectWithEncryption,
    database: string
  ): Promise<QueryExecutionSchema.QueryExecutionResponse>

  public async execute(
    database: string,
    query: QueryExecutionSchema.Query
  ): Promise<QueryExecutionSchema.QueryExecutionResponse> {
    if (query.type !== 'sql') {
      throw new Error('Invalid query type')
    }

    // SQL queries require a connection with a read-only connection for safety purposes
    if (!this.connection.readonly_connection_id) {
      throw new Errors.MissingReadonlyConnectionError(this.connection.name)
    }

    const readonlyConnection = await ConnectionService.getById(
      this.connection.readonly_connection_id
    )

    if (!readonlyConnection) {
      throw new Error(
        `Error trying to find read-only connection for ${this.connection.name}.`
      )
    }

    return this.executeSql(query.sql, readonlyConnection, database)
  }
}
