import { Kysely, PostgresDialect, sql } from 'kysely'

import { getDb, logger } from '../../..'
import { PG7_DATABASE_TABLE } from '../../../constants/database.constant'
import * as SharedUtils from '../../../utils'
import * as UserService from '../../user.service'
import { BaseSchemaImportService } from '../schema-import.base.service'

import { PostgresDatabaseBuilder } from './db-builder.service'

import type { ConnectionSelectWithEncryption } from '../../../types/kysely/connection/connection.type'
import type { FastifyBaseLogger } from 'fastify'
import type { Pool } from 'pg'

/* eslint-disable  @typescript-eslint/no-non-null-assertion */

export class PostgresSchemaImportService extends BaseSchemaImportService<'postgres'> {
  constructor(protected connection: ConnectionSelectWithEncryption) {
    super('postgres', connection)
  }

  private async getDatabases(): Promise<string[]> {
    let pool: Pool | null = null
    let databases: string[] | null = null
    let db: Kysely<unknown> | null = null

    try {
      const connString = await this.connection.connection_string.decrypt()

      pool = SharedUtils.createPg7Pool(connString, this.connection.with_ssl, {
        max: 100,
        allowExitOnIdle: true
      })

      db = new Kysely({
        dialect: new PostgresDialect({
          pool
        })
      })

      const result = await sql<{
        datname: string
      }>`SELECT datname FROM ${sql.table(
        PG7_DATABASE_TABLE
      )} WHERE datistemplate = false`.execute(db)

      databases = result.rows.map(n => n.datname) ?? null
    } catch (e) {
      logger.error(e, `Failed to retrieve databases from ${this.connection.id}`)
      throw e
    } finally {
      if (db) await db.destroy()
    }

    return databases
  }

  async createDatabaseBuilder() {
    const connString = await this.connection.connection_string.decrypt()
    return new PostgresDatabaseBuilder(connString, this.connection.with_ssl)
  }

  async importSchema(userId: string, log: FastifyBaseLogger): Promise<string> {
    const dbNames = await this.getDatabases()

    if (!dbNames || dbNames.length === 0) {
      throw new Error('No databases found in Connection')
    }

    const user = await UserService.getUserById(userId)
    if (!user) {
      throw new Error(`User with id: ${userId} not found`)
    }

    return this.createSnapshot(dbNames, log, userId)
  }

  async getSchemaImportStatus(id: string) {
    return await getDb()
      .selectFrom('snapshot')
      .where('id', '=', id)
      .select('status')
      .executeTakeFirstOrThrow()
      .then(n => n.status)
  }
}
