import { randomUUID } from 'node:crypto'

import { getDb } from '../../'
import * as SnapshotColumnService from '../../services/kysely/snapshot/column.service'

import type { ColumnInsert } from '../../types/kysely/snapshot/column.type'

export class SnapshotColumnMock {
  public columnIds: string[] = []

  create(values: Partial<ColumnInsert> = {}) {
    const mock = {
      id: randomUUID(),
      table_id: randomUUID(),
      name: `raw-column-${randomUUID()}`,
      nullable: false,
      type: 'text',
      position: 0,
      is_primary_key: false,
      has_default: false,
      ...values
    } satisfies ColumnInsert

    this.columnIds.push(mock.id)

    return mock
  }

  async insert(column: ColumnInsert) {
    await SnapshotColumnService.insertColumn(getDb(), column)
  }

  async removeAll() {
    for (const id of this.columnIds) {
      await SnapshotColumnService.removeColumn(id)
    }
  }
}
