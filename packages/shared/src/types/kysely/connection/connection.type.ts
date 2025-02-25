import type { EncryptedField } from '../../../utils/crypt.util'
import type { SortDB } from '../../kysely.type'
import type { Insertable, Selectable, Updateable } from 'kysely'

export type ConnectionSelect = Selectable<SortDB['connection']>
export type ConnectionInsert = Insertable<SortDB['connection']>
export type ConnectionUpdate = Updateable<SortDB['connection']>

export type ConnectionSelectWithEncryption = Omit<
  ConnectionSelect,
  'connection_string'
> & {
  connection_string: EncryptedField
}

export type ConnectionInsertWithEncryption = Omit<
  ConnectionInsert,
  'connection_string'
> & {
  connection_string: EncryptedField
}

export type ConnectionUpdateWithEncryption = Omit<
  ConnectionUpdate,
  'connection_string'
> & {
  connection_string?: EncryptedField
}
