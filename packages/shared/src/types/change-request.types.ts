import type { SortDB } from './kysely.type'
import type { Insertable, Selectable, Updateable } from 'kysely'

// TODO: link this to reference table
export type ChangeRequestJobStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'

export type ChangeRequestSelect = Selectable<SortDB['change_request']>
export type ChangeRequestInsert = Insertable<SortDB['change_request']>

export type ChangeRequestJobSelect = Selectable<SortDB['change_request_job']>
export type ChangeRequestJobUpdate = Updateable<SortDB['change_request_job']>

export type ChangeSelect = Selectable<SortDB['change']>
export type ChangeInsert = Insertable<SortDB['change']>

export type ChangePrimaryKeySelect = Selectable<SortDB['change_primary_key']>
export type ChangePrimaryKeyInsert = Insertable<SortDB['change_primary_key']>

export type ChangeFieldValueSelect = Selectable<SortDB['change_field_value']>
export type ChangeFieldValueInsert = Insertable<SortDB['change_field_value']>

export type ChangePreviousFieldValueSelect = Selectable<
  SortDB['change_previous_field_value']
>
export type ChangePreviousFieldValueInsert = Insertable<
  SortDB['change_previous_field_value']
>

export type ChangePreviousPrimaryKeySelect = Selectable<
  SortDB['change_previous_primary_key']
>
export type ChangePreviousPrimaryKeyInsert = Insertable<
  SortDB['change_previous_primary_key']
>
