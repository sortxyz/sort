import { randomUUID } from 'node:crypto'

import { snapshotInsertMock } from '@sort/shared/mocks/snapshot/postgres.snapshot.mock'
import { SnapshotColumnMock } from '@sort/shared/mocks/snapshot/snapshot-column.mock'
import { SnapshotDatabaseMock } from '@sort/shared/mocks/snapshot/snapshot-database.mock'
import { SnapshotSchemaMock } from '@sort/shared/mocks/snapshot/snapshot-schema.mock'
import { SnapshotTableMock } from '@sort/shared/mocks/snapshot/snapshot-table.mock'
import { removeSnapshot } from '@sort/shared/services/kysely/snapshot/snapshot.service'

import type { SnapshotInsert } from '@sort/shared/types/kysely/snapshot/snapshot.type'

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
