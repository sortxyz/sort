import { parse } from 'pg-connection-string'

import { getConfig, logger } from '../../bootstrap'
import { createPg7Pool } from '../../utils/connection.util'

import { ConnectionServiceBase } from './base.service'

import type { ConnectionServiceTest } from '../../schemas/connection.schema'
import type { ConnectionInsert } from '../../types/kysely/connection/connection.type'
import type { Pool, PoolClient } from 'pg'

/* eslint-disable  @typescript-eslint/no-non-null-assertion */

export class PostgresService extends ConnectionServiceBase<'postgres'> {
  constructor(protected connection: ConnectionInsert) {
    super('postgres', connection)

    this.validatePgConnection()
  }

  protected db: Pool | null = null

  private validatePgConnection(): void {
    if (!this.connection.connection_string) {
      throw new Error(
        `Connection string is missing for connection: ${this.connection.id}`
      )
    }

    // Reference for parsing rules: https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING-URIS
    if (
      !this.connection.connection_string.startsWith('postgres://') &&
      !this.connection.connection_string.startsWith('postgresql://')
    ) {
      throw new Error(
        `Invalid connection string for connection: ${this.connection.id}`
      )
    }

    if (!(getConfig().IS_TEST_ENV || getConfig().IS_LOCAL_DB_CONNECTION_OK)) {
      let failed = false

      try {
        const url = parse(this.connection.connection_string)

        for (const bannedHost of bannedHosts) {
          failed = !url.host
            ? true
            : bannedHost.startsWith
              ? url.host.startsWith(bannedHost.host)
              : url.host === bannedHost.host
          if (failed) break
        }
      } catch (error) {
        failed = true
      }

      if (failed) {
        throw new Error(`Invalid host for connection: ${this.connection.id}`)
      }
    }

    if (
      this.connection.connection_string.includes('?') &&
      /sslcert|sslkey|sslrootcert/.test(
        this.connection.connection_string.split('?')[1]
      )
    ) {
      throw new Error(
        `SSL certificates are not supported for connection: ${this.connection.id}`
      )
    }
  }

  private async testConnection(
    options: { withSsl: boolean } = { withSsl: false }
  ): Promise<boolean> {
    let poolClient: PoolClient | undefined

    await this.createConnection(
      this.connection.connection_string,
      options.withSsl
    )

    try {
      poolClient = await this.db!.connect()

      const result = (await poolClient.query(
        'select datname from pg_catalog.pg_database limit 1'
      )) as {
        rows: { datname: string }[]
      }

      logger.debug(`Successfully connected to: ${this.connection.name}`)

      return !!result.rows[0]?.datname
    } catch (e) {
      logger.debug(`Failed to connect to: ${this.connection.name}`)
      return false
    } finally {
      if (poolClient) {
        poolClient.release()
      }
    }
  }

  /**
   * Test the connection to the database; we try with ssl first, then without.
   */
  async tryCreateConnection(): Promise<ConnectionServiceTest | null> {
    if (await this.testConnection({ withSsl: true })) {
      return {
        connection_string: this.connection.connection_string,
        visibility: this.connection.visibility,
        with_ssl: true,
        warehouse: null
      }
    }

    if (await this.testConnection({ withSsl: false })) {
      return {
        connection_string: this.connection.connection_string,
        visibility: this.connection.visibility,
        with_ssl: false,
        warehouse: null
      }
    }

    return null
  }

  private async createConnection(connectionString: string, withSsl: boolean) {
    this.db = createPg7Pool(connectionString, withSsl)
    return Promise.resolve(this.db)
  }

  async closeConnection(): Promise<void> {
    if (this.db) {
      return this.db.end()
    }
    return Promise.resolve()
  }
}

// Much from https://github.com/coreruleset/coreruleset/blob/44b82683028188f770541567db760e24810e84ca/rules/ssrf.data#L39
export const bannedHosts: { host: string; startsWith: boolean }[] = [
  // evasion techniques
  { host: '2852039166', startsWith: false },
  { host: '025177524776', startsWith: false },
  { host: '0251.0376.0251.0376', startsWith: false },
  { host: '0xA9.0xFE.0xA9.0xFE', startsWith: false },
  { host: '0xA9FEA9FE', startsWith: false },
  { host: '0251.254.169.254', startsWith: false },
  { host: '[::ffff:a9fe:a9fe]', startsWith: false },
  { host: '[0:0:0:0:0:ffff:a9fe:a9fe]', startsWith: false },
  { host: '[0:0:0:0:0:ffff:169.254.169.254]', startsWith: false },
  { host: '169.254.169.254.nip.io', startsWith: false },
  { host: 'nicob.net', startsWith: false },
  { host: '2130706433', startsWith: false },
  { host: '192.168.', startsWith: true },
  { host: '3232235521', startsWith: false },
  { host: '3232235777', startsWith: false },
  { host: '2852039166', startsWith: false },
  { host: '[::]', startsWith: false },
  // prod kubernetes
  { host: '172.18.', startsWith: true },
  // localhost bypass
  { host: '10.100.0.0', startsWith: false },
  { host: 'localtest.me', startsWith: false },
  { host: '127.', startsWith: true },
  { host: '0.0.0.0', startsWith: false },
  { host: 'localhost', startsWith: false },
  { host: '0177.0.0.1', startsWith: false },
  { host: '::1', startsWith: false },
  { host: '[::1]', startsWith: false },
  { host: '[0000::1]', startsWith: false },
  { host: '[::ffff:127.0.0.1]', startsWith: false },
  { host: '[0:0:0:0:0:ffff:127.0.0.1]', startsWith: false },
  { host: '[::ffff:7f00:1]', startsWith: false },
  { host: '0', startsWith: false }
]
