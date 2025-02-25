import type { SortDB } from '../../kysely.type'
import type { Insertable, Selectable } from 'kysely'

export type ColumnSelect = Selectable<SortDB['snapshot_column']>
export type ColumnInsert = Insertable<SortDB['snapshot_column']>
