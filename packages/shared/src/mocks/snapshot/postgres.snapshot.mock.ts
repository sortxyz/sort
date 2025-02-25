import { randomUUID } from 'node:crypto'

import { removeSnapshot } from '../../services/kysely/snapshot/snapshot.service'
import { postgresConnectionMock } from '../connection.mock'
import { userMock } from '../user.mock'

import type { ColumnInsert } from '../../types/kysely/snapshot/column.type'
import type {
  DatabaseInsertWithRelations,
  DatabaseSelectWithRelations
} from '../../types/kysely/snapshot/database.type'
import type {
  SchemaInsertWithRelations,
  SchemaSelectWithRelations
} from '../../types/kysely/snapshot/schema.type'
import type {
  SnapshotInsert,
  SnapshotUpdateWithRelations
} from '../../types/kysely/snapshot/snapshot.type'
import type {
  TableInsertWithRelations,
  TableSelectWithRelations
} from '../../types/kysely/snapshot/table.type'

export const snapshotColumnOneRaw = {
  id: '3d756184-f550-4c04-8e30-62862a5a64fe',
  name: 'id',
  type: 'uuid',
  position: 0,
  nullable: false,
  table_id: 'c6ef2e7d-90f7-48f0-8c19-c5a3635bf5df',
  is_primary_key: true,
  has_default: false
}

export const snapshotColumnTwoRaw = {
  id: '92ca03f8-cb87-4e5e-8682-dc9c956c66c3',
  name: 'name',
  type: 'varchar(255)',
  position: 0,
  nullable: true,
  table_id: 'c6ef2e7d-90f7-48f0-8c19-c5a3635bf5df',
  is_primary_key: false,
  has_default: false
}

export const snapshotTableRaw = {
  id: 'c6ef2e7d-90f7-48f0-8c19-c5a3635bf5df',
  name: 'users',
  is_view: false,
  schema_id: 'c0e10931-86aa-4a5b-8630-288fe1a45e48'
}

export const snapshotSchemaRaw1 = {
  name: 'public',
  id: 'c0e10931-86aa-4a5b-8630-288fe1a45e48',
  database_id: '26adb4c1-a202-4f7b-a519-93e16f18e647'
}

export const snapshotSchemaRaw2 = {
  name: 'public',
  id: '3d7d360a-f6f7-41da-8ba9-4ba192a63bbd',
  database_id: 'cc2788cd-083c-4029-959a-7d5fdedc45a9'
}

export const snapshotDatabaseRaw1 = {
  name: 'sort_xyz',
  id: '26adb4c1-a202-4f7b-a519-93e16f18e647',
  snapshot_id: '5b0c0390-2fff-41f5-ba6a-ab78cd4139a9'
}

export const snapshotDatabaseRaw2 = {
  name: 'postgres',
  id: 'cc2788cd-083c-4029-959a-7d5fdedc45a9',
  snapshot_id: '5b0c0390-2fff-41f5-ba6a-ab78cd4139a9'
}

export const snapshotInsertDatabasesMock = [
  {
    ...snapshotDatabaseRaw1,
    insertSchemas: [
      {
        ...snapshotSchemaRaw1,
        insertTables: [
          {
            ...snapshotTableRaw,
            insertColumns: [
              snapshotColumnOneRaw,
              snapshotColumnTwoRaw
            ] satisfies ColumnInsert[]
          }
        ] satisfies TableInsertWithRelations[]
      }
    ] satisfies SchemaInsertWithRelations[]
  },
  {
    ...snapshotDatabaseRaw2,
    insertSchemas: [
      {
        ...snapshotSchemaRaw2,
        insertTables: []
      }
    ]
  }
] satisfies DatabaseInsertWithRelations[]

export const snapshotSelectDatabasesMock = [
  {
    ...snapshotDatabaseRaw1,
    selectSchemas: [
      {
        ...snapshotSchemaRaw1,
        selectTables: [
          {
            ...snapshotTableRaw,
            selectColumns: [
              snapshotColumnOneRaw,
              snapshotColumnTwoRaw
            ] satisfies ColumnInsert[]
          }
        ] satisfies TableSelectWithRelations[]
      }
    ] satisfies SchemaSelectWithRelations[]
  }
] satisfies DatabaseSelectWithRelations[]

export const snapshotInsertMock = {
  id: '5b0c0390-2fff-41f5-ba6a-ab78cd4139a9',
  status: 'RUNNING' as const,
  timestamp: new Date(),
  connection_id: postgresConnectionMock.id,
  creator: userMock.id
} satisfies SnapshotInsert

export const snapshotUpdateMock = {
  id: '5b0c0390-2fff-41f5-ba6a-ab78cd4139a9',
  status: 'COMPLETED' as const,
  timestamp: new Date(),
  connection_id: postgresConnectionMock.id,
  creator: userMock.id,
  insertDatabases: snapshotInsertDatabasesMock
} satisfies SnapshotUpdateWithRelations

export class SnapshotMock {
  public snapshotIds: string[] = []

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
