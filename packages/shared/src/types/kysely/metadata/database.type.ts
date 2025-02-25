import type { SortDB } from '../../kysely.type'
import type { Insertable, Selectable } from 'kysely'

export type DatabaseSelect = Selectable<SortDB['metadata_database']>
export type DatabaseInsert = Insertable<SortDB['metadata_database']>
