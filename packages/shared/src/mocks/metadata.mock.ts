import * as crypto from 'crypto'

import {
  removeMetadataDb,
  removeMetadataDbsByConnectionIds
} from '../services/kysely/metadata/database.service'
import { removeTable } from '../services/kysely/metadata/table.service'

import type { SortDB } from '../types/kysely.type'

type MetadataDatabase = SortDB['metadata_database']
type MetadataTable = SortDB['metadata_table']

const sixtyRandomBytes = () => crypto.randomBytes(60).toString('hex')

export class MetadataDatabaseMock {
  public dbMocks: MetadataDatabase[] = []

  create(values?: Partial<MetadataDatabase>): MetadataDatabase {
    const rawName = crypto.randomUUID()

    const mock = {
      raw_name: rawName,
      slug: `${rawName}-1`,
      connection_id: crypto.randomUUID(),
      display_name: sixtyRandomBytes(),
      description: sixtyRandomBytes(),
      summary: sixtyRandomBytes(),
      link: `https://example.com/${rawName}`,
      organization_id: crypto.randomUUID(),
      ...values
    } satisfies MetadataDatabase

    this.dbMocks.push(mock)

    return mock
  }

  async removeAll(): Promise<void> {
    for (const mock of this.dbMocks) {
      await removeMetadataDb(mock.connection_id, mock.slug ?? mock.raw_name)
    }
  }

  async removeAllByConnectionIds(connectionIds: string[]): Promise<void> {
    await removeMetadataDbsByConnectionIds(connectionIds)
  }
}

export class MetadataTableMock {
  public tableMocks: MetadataTable[] = []

  create(values?: Partial<MetadataTable>): MetadataTable {
    const mock = {
      raw_name: sixtyRandomBytes(),
      connection_id: crypto.randomUUID(),
      raw_database_name: sixtyRandomBytes(),
      raw_schema_name: sixtyRandomBytes(),
      display_name: sixtyRandomBytes(),
      summary: sixtyRandomBytes(),
      ...values
    } satisfies MetadataTable

    this.tableMocks.push(mock)

    return mock
  }

  async removeAll(): Promise<void> {
    for (const mock of this.tableMocks) {
      await removeTable(
        mock.connection_id,
        mock.raw_name,
        mock.raw_schema_name,
        mock.raw_database_name
      )
    }
  }
}
