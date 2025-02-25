import { randomUUID } from 'node:crypto'

import { getDb } from '../'

import type { Label } from '../schemas/label.schema'

export class LabelMock {
  mockIds: string[] = []

  create(values: Partial<Label> = {}) {
    const id = randomUUID()
    const mock = {
      id,
      name: `Label ${id.slice(0, 10)}`,
      color: `#${Math.floor(Math.random() * 16777215)
        .toString(16)
        .padStart(6, '0')}`, // random hex color code
      description: null,
      connection_id: randomUUID(),
      database_name: `raw-db-${id.slice(0, 10)}`,
      ...values
    } satisfies Label
    return mock
  }

  addMockId(id: string) {
    this.mockIds.push(id)
  }

  async removeAll() {
    if (this.mockIds.length) {
      await getDb()
        .deleteFrom('label')
        .where('id', 'in', this.mockIds)
        .execute()

      this.mockIds = []
    }
  }
}
