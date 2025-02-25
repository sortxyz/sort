import * as snowflake from 'snowflake-sdk'

import { PublicFacingError } from '../../errors/public-facing.error'
import { parseSnowflakeConnectionString } from '../../utils/connection.util'
import { executeStatement } from '../../utils/snowflake/sql.util'

import { ConnectionServiceBase } from './base.service'

import type { ConnectionServiceTest } from '../../schemas/connection.schema'
import type { ConnectionInsert } from '../../types/kysely/connection/connection.type'
import type { ParsedSnowflakeConnectionString } from '../../utils/connection.util'
import type { Pool } from 'generic-pool'

snowflake.configure({ logLevel: 'ERROR' })

// eslint-disable-next-line import/order
import { logger } from '../../bootstrap'

export class SnowflakeService extends ConnectionServiceBase<'snowflake'> {
  constructor(protected connection: ConnectionInsert) {
    super('snowflake', connection)

    this.connectionDetails = parseSnowflakeConnectionString(
      connection.connection_string
    )

    if (!connection.warehouse) {
      throw new Error('No warehouse provided')
    }

    this.warehouse = connection.warehouse
  }

  public pool?: Pool<snowflake.Connection>

  private connectionDetails: ParsedSnowflakeConnectionString
  private warehouse: string

  async fetchWarehouses(conn: snowflake.Connection) {
    const { promise, resolve, reject } =
      Promise.withResolvers<{ name: string }[]>()

    executeStatement({
      resolve,
      reject,
      clientConnection: conn,
      sqlText: 'SHOW WAREHOUSES;'
    })

    const warehouses = await promise
    const names = warehouses.map(warehouse => warehouse.name)
    logger.debug({ warehouses: names }, 'snowflake warehouses')
    return names
  }

  async fetchDatabases(conn: snowflake.Connection) {
    const { promise, resolve, reject } =
      Promise.withResolvers<{ name: string }[]>()

    executeStatement({
      resolve,
      reject,
      clientConnection: conn,
      sqlText: 'SHOW DATABASES;'
    })

    const dbs = await promise
    const names = dbs.map(db => db.name)
    logger.debug({ databases: names }, 'snowflake databases')
    return names
  }

  async tryCreateConnection(): Promise<ConnectionServiceTest> {
    await this.createPool()

    return {
      connection_string: this.connection.connection_string,
      warehouse: this.warehouse,
      visibility: this.connection.visibility,
      with_ssl: false
    }
  }

  async testCredentials({
    warehouse,
    database
  }: {
    warehouse: string
    database: string
  }) {
    const conn = await this.createSingleConnection({
      database,
      warehouse
    })

    const warehouses = await this.fetchWarehouses(conn)
    if (!warehouses.includes(warehouse)) {
      throw new PublicFacingError(
        `Warehouse "${warehouse}" does not exist or is not accessible to this user.`
      )
    }

    const dbs = await this.fetchDatabases(conn)
    if (!dbs.includes(database)) {
      throw new PublicFacingError(`Database "${database}" not found.`)
    }

    conn.destroy(_err => {
      /* ignore */
    })
  }

  private async createSingleConnection({
    database,
    warehouse
  }: {
    database?: string
    warehouse?: string
  } = {}) {
    return await new Promise<snowflake.Connection>((resolve, reject) => {
      const conn = snowflake.createConnection({
        account: this.connectionDetails.account,
        username: this.connectionDetails.user,
        password: this.connectionDetails.password,
        database: database ?? this.connectionDetails.database,
        warehouse
      })

      void conn.connectAsync((err, conn) => {
        if (err) {
          return reject(err)
        } else {
          return resolve(conn)
        }
      })
    })
  }

  async createPool({
    warehouse = this.warehouse,
    database = this.connectionDetails.database
  }: {
    warehouse?: string
    database?: string
  } = {}) {
    if (this.pool) return this.pool

    await this.testCredentials({ database, warehouse })

    const pool = snowflake.createPool(
      {
        account: this.connectionDetails.account,
        username: this.connectionDetails.user,
        password: this.connectionDetails.password,
        database,
        warehouse
      } satisfies snowflake.ConnectionOptions,
      {
        min: 1,
        max: 20
      }
    )

    logger.debug(`Successfully connected to: ${this.connection.name}`)

    this.pool = pool
    return pool
  }

  async closePool(): Promise<void> {
    if (this.pool) {
      await this.pool.drain()
      delete this.pool
    }
  }
}
