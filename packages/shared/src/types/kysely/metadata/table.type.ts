import type { SortDB } from '../../kysely.type'
import type { Insertable, Selectable } from 'kysely'

export type TableSelect = Selectable<SortDB['metadata_table']>
export type TableInsert = Insertable<SortDB['metadata_table']>
