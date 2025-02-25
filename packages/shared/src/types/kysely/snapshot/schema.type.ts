import type {
  TableInsertWithRelations,
  TableSelectWithRelations
} from './table.type'
import type { SortDB } from '../../kysely.type'
import type { Insertable, Selectable } from 'kysely'

export type SchemaSelect = Selectable<SortDB['snapshot_schema']>
export type SchemaInsert = Insertable<SortDB['snapshot_schema']>

export type SchemaInsertWithRelations = SchemaInsert & {
  insertTables?: TableInsertWithRelations[]
}

export type SchemaSelectWithRelations = SchemaSelect & {
  selectTables?: TableSelectWithRelations[]
}
