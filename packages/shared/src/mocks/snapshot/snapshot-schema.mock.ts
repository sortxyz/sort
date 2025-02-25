import { randomUUID } from 'node:crypto'

import { getDb } from '../../'
import * as SnapshotSchemaService from '../../services/kysely/snapshot/schema.service'

import type { SchemaInsert } from '../../types/kysely/snapshot/schema.type'

export class SnapshotSchemaMock {
  public schemaIds: string[] = []

  create(values: Partial<SchemaInsert> = {}) {
    const mock = {
      id: randomUUID(),
      database_id: randomUUID(),
      name: `raw-schema-${randomUUID()}`,
      ...values
    } satisfies SchemaInsert

    this.schemaIds.push(mock.id)

    return mock
  }

  async insert(schema: SchemaInsert) {
    await SnapshotSchemaService.insertSchemaOld(getDb(), schema)
  }

  async removeAll() {
    for (const id of this.schemaIds) {
      await SnapshotSchemaService.removeSchema(id)
    }
  }
}
