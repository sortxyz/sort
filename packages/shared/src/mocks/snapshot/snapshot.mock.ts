import { randomUUID } from 'node:crypto'

import { removeSnapshot } from '../../services/kysely/snapshot/snapshot.service'

import { snapshotInsertMock } from './postgres.snapshot.mock'
import { SnapshotColumnMock } from './snapshot-column.mock'
import { SnapshotDatabaseMock } from './snapshot-database.mock'
import { SnapshotSchemaMock } from './snapshot-schema.mock'
import { SnapshotTableMock } from './snapshot-table.mock'

import type { SnapshotInsert } from '../../types/kysely/snapshot/snapshot.type'

export class SnapshotMock {
  public snapshotIds: string[] = []

  public DatabaseMock = new SnapshotDatabaseMock()
  public SchemaMock = new SnapshotSchemaMock()
  public TableMock = new SnapshotTableMock()
  public ColumnMock = new SnapshotColumnMock()

  push(id: string) {
    this.snapshotIds.push(id)
  }

  create(values: Partial<SnapshotInsert> = {}) {
    const mock = {
      ...snapshotInsertMock,
      id: randomUUID(),
      ...values
    } satisfies SnapshotInsert

    this.snapshotIds.push(mock.id)

    return mock
  }

  async removeAll(): Promise<void> {
    for (const id of this.snapshotIds) {
      await removeSnapshot(id)
    }
  }
}
