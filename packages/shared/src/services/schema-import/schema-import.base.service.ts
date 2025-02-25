import { randomUUID } from 'node:crypto'

import { getDb } from '../..'
import {
  insertSnapshot,
  updateSnapshot,
  removeSnapshot
} from '../kysely/snapshot/snapshot.service'

import type { ConnectionDataProvider } from '../../schemas/data-provider.schema'
import type { ConnectionSelectWithEncryption } from '../../types/kysely/connection/connection.type'
import type { DatabaseInsertWithRelations } from '../../types/kysely/snapshot/database.type'
import type {
  SnapshotInsert,
  SnapshotUpdateWithRelations
} from '../../types/kysely/snapshot/snapshot.type'
import type { SortDB } from '../../types/kysely.type'
import type { FastifyBaseLogger } from 'fastify'
import type { Kysely } from 'kysely'

export type BaseDatabaseBuilderService = {
  processDb(
    snapshotId: string,
    dbName: string
  ): Promise<DatabaseInsertWithRelations | null>
}

export abstract class BaseSchemaImportService<
  TConnectionDataProvider extends ConnectionDataProvider
> {
  constructor(
    dataProvider: TConnectionDataProvider,
    protected connection: ConnectionSelectWithEncryption
  ) {
    if (dataProvider !== this.connection.data_provider) {
      throw new Error(
        `Invalid data provider ${dataProvider} for connection ${this.connection.id}`
      )
    }
  }

  abstract importSchema(userId: string, log: FastifyBaseLogger): Promise<string>

  async beginSnapshot(
    sortDb: Kysely<SortDB>,
    userId: string,
    log: FastifyBaseLogger
  ) {
    log.info(`Begin snapshot for "${this.connection.id}"`)

    const snapshot = {
      id: randomUUID(),
      connection_id: this.connection.id,
      status: 'RUNNING',
      creator: userId,
      timestamp: new Date()
    } satisfies SnapshotInsert

    await insertSnapshot(sortDb, snapshot)

    return snapshot
  }

  abstract createDatabaseBuilder(): Promise<BaseDatabaseBuilderService>

  async fetchCustomerData(
    snapshotId: string,
    dbNames: string[],
    log: FastifyBaseLogger
  ) {
    const databases: DatabaseInsertWithRelations[] = []
    let status: 'COMPLETED' | 'FAILED' = 'COMPLETED'

    for (const dbName of dbNames) {
      try {
        const builder = await this.createDatabaseBuilder()
        const database = await builder.processDb(snapshotId, dbName)

        if (database?.insertSchemas?.length) {
          databases.push(database)
        }
      } catch (err) {
        status = 'FAILED'
        log.error(
          err,
          `Failed to import database "${dbName}" on connection "${this.connection.id}".`
        )
      }
    }

    return {
      databases,
      status
    }
  }

  async updateSnapshot(
    sortDb: Kysely<SortDB>,
    snapshotRow: SnapshotInsert & { id: string },
    status: 'COMPLETED' | 'FAILED',
    databases: DatabaseInsertWithRelations[],
    log: FastifyBaseLogger
  ): Promise<SnapshotUpdateWithRelations> {
    const { id, ...snapshot } = snapshotRow

    const finishedSnapshot = {
      ...snapshot,
      status,
      insertDatabases: databases
    } satisfies SnapshotUpdateWithRelations

    await updateSnapshot(
      sortDb,
      this.connection.organization_id,
      finishedSnapshot,
      id
    )

    log.info(`Snapshot ${status} for connection "${this.connection.id}".`)

    return { ...finishedSnapshot, id, insertDatabases: databases }
  }

  async createSnapshot(
    dbNames: string[],
    log: FastifyBaseLogger,
    userId: string
  ) {
    let id = ''

    try {
      // Creating the snapshot row outside the import transaction *greatly*
      // reduces database contention.
      const snapshotRow = await this.beginSnapshot(getDb(), userId, log)
      id = snapshotRow.id

      const { databases, status } = await this.fetchCustomerData(
        id,
        dbNames,
        log
      )

      await getDb()
        .transaction()
        .execute(async trx => {
          await this.updateSnapshot(trx, snapshotRow, status, databases, log)
        })
    } catch (e) {
      try {
        log.info(`Deleting snapshot "${id}"`)
        await removeSnapshot(id)
      } catch (error) {
        log.error(
          error,
          `Failed to delete snapshot (connection_id: "${this.connection.id}", snapshot_id: "${id}")`
        )
      }

      const err = e as Error
      err.message = `Failed to import schema (connection_id: "${this.connection.id}", snapshot_id: "${id}"). ${err.message}`
      throw err
    }

    return id
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
