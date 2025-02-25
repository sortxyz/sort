import type { ColumnInsert, ColumnSelect } from './column.type'
import type { SortDB } from '../../kysely.type'
import type { Insertable, Selectable } from 'kysely'

export type TableSelect = Selectable<SortDB['snapshot_table']>
export type TableInsert = Insertable<SortDB['snapshot_table']>

export type TableInsertWithRelations = TableInsert & {
  insertColumns?: ColumnInsert[]
}

export type TableSelectWithRelations = TableSelect & {
  selectColumns?: ColumnSelect[]
}
