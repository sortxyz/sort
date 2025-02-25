import type {
  SchemaInsertWithRelations,
  SchemaSelectWithRelations
} from './schema.type'
import type { SortDB } from '../../kysely.type'
import type { Insertable, Selectable } from 'kysely'

export type DatabaseSelect = Selectable<SortDB['snapshot_database']>
export type DatabaseInsert = Insertable<SortDB['snapshot_database']>

export type DatabaseInsertWithRelations = DatabaseInsert & {
  insertSchemas?: SchemaInsertWithRelations[]
}

export type DatabaseSelectWithRelations = DatabaseSelect & {
  selectSchemas?: SchemaSelectWithRelations[]
}
