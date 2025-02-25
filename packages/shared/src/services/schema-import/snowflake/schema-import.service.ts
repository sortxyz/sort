import * as DatabaseConstants from '../../../constants/database.constant'
import { SnowflakeService } from '../../customer-connection/snowflake.service'
import * as UserService from '../../user.service'
import { BaseSchemaImportService } from '../schema-import.base.service'

import { SnowflakeDatabaseBuilder } from './db-builder.service'

import type { ConnectionSelectWithEncryption } from '../../../types/kysely/connection/connection.type'
import type { FastifyBaseLogger } from 'fastify'
import type { SnowflakeError, RowStatement } from 'snowflake-sdk'

export class SnowflakeSchemaImportService extends BaseSchemaImportService<'snowflake'> {
  constructor(protected connection: ConnectionSelectWithEncryption) {
    super('snowflake', connection)
  }

  protected snowflakeService: SnowflakeService | undefined

  private async getSnowflakeService() {
    if (this.snowflakeService) return this.snowflakeService

    const connString = await this.connection.connection_string.decrypt()
    this.snowflakeService = new SnowflakeService({
      ...this.connection,
      connection_string: connString
    })

    return this.snowflakeService
  }

  private snowflakeCompletionHandler(
    log: FastifyBaseLogger,
    resolve: (value: string[] | PromiseLike<string[]>) => void,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reject: (reason?: any) => void,
    err: SnowflakeError | undefined,
    stmt: RowStatement,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rows: any[] | undefined
  ) {
    if (err) {
      log.error(
        err,
        `Failed to retrieve databases for: ${this.connection.name}`
      )
      return reject(err)
    }

    // we don't want the native snowflake sample dbs
    if (rows && rows.length) {
      const nameRows = rows as { name: string }[]
      const names: string[] = nameRows
        .map(n => n.name)
        .filter(
          n => !DatabaseConstants.SNOWFLAKE_EXCLUDED_DATABASES.includes(n)
        )

      return resolve(names)
    }

    return reject(new Error('No rows returned'))
  }

  private async getDatabases(log: FastifyBaseLogger): Promise<string[]> {
    const service = await this.getSnowflakeService()

    return service.pool!.use(clientConnection => {
      return new Promise<string[]>((resolve, reject) => {
        clientConnection.execute({
          sqlText: 'SHOW DATABASES',
          complete: (err, stmt, rows) =>
            this.snowflakeCompletionHandler(
              log,
              resolve,
              reject,
              err,
              stmt,
              rows
            )
        })
      })
    })
  }

  async createDatabaseBuilder() {
    const service = await this.getSnowflakeService()
    return new SnowflakeDatabaseBuilder(service)
  }

  async importSchema(userId: string, log: FastifyBaseLogger): Promise<string> {
    const service = await this.getSnowflakeService()
    await service.createPool()

    const user = await UserService.getUserById(userId)
    if (!user) {
      throw new Error(`User with id: ${userId} not found`)
    }

    try {
      const dbs = await this.getDatabases(log)

      const result = await this.createSnapshot(dbs, log, userId)

      return result
    } finally {
      await service.closePool()
    }
  }
}
