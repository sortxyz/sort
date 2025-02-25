import { randomUUID } from 'node:crypto'

import { getDb } from '../../'
import * as SnapshotTableService from '../../services/kysely/snapshot/table.service'

import type { TableInsert } from '../../types/kysely/snapshot/table.type'

export class SnapshotTableMock {
  public tableIds: string[] = []

  create(values: Partial<TableInsert> = {}) {
    const mock = {
      id: randomUUID(),
      is_view: false,
      name: `raw-table-${randomUUID()}`,
      schema_id: randomUUID(),
      ...values
    } satisfies TableInsert

    this.tableIds.push(mock.id)

    return mock
  }

  async insert({
    table,
    connectionId,
    databaseName,
    schemaName
  }: {
    table: TableInsert
    connectionId: string
    databaseName: string
    schemaName: string
  }) {
    await SnapshotTableService.insertTable(
      getDb(),
      connectionId,
      databaseName,
      schemaName,
      table
    )
  }

  async removeAll() {
    for (const id of this.tableIds) {
      await SnapshotTableService.removeTable(id)
    }
  }
}
