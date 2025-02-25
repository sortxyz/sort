import type { DatabaseInsertWithRelations } from './database.type'
import type { SortDB } from '../../kysely.type'
import type { Insertable, Selectable, Updateable } from 'kysely'

export type SnapshotSelect = Selectable<SortDB['snapshot']>
export type SnapshotInsert = Insertable<SortDB['snapshot']>
export type SnapshotUpdate = Updateable<SortDB['snapshot']>

export type SnapshotUpdateWithRelations = SnapshotUpdate & {
  connection_id: string
  insertDatabases?: DatabaseInsertWithRelations[]
}
