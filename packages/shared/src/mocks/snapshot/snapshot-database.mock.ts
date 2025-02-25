import { randomUUID } from 'node:crypto'

import { getDb } from '../../'
import * as SnapshotDatabaseService from '../../services/kysely/snapshot/database.service'

import type { DatabaseInsert } from '../../types/kysely/snapshot/database.type'

export class SnapshotDatabaseMock {
  public databaseIds: string[] = []

  create(values: Partial<DatabaseInsert> = {}) {
    const mock = {
      id: randomUUID(),
      name: `raw-database-${randomUUID()}`,
      snapshot_id: randomUUID(),
      ...values
    } satisfies DatabaseInsert

    this.databaseIds.push(mock.id)

    return mock
  }

  async insert(database: DatabaseInsert) {
    await SnapshotDatabaseService.insertDatabaseOld(getDb(), database)
  }

  async removeAll() {
    for (const id of this.databaseIds) {
      await SnapshotDatabaseService.removeDatabase(id)
    }
  }
}
