import { getDb } from '../'
import { EncryptedField } from '../utils/crypt.util'

import type {
  ConnectionInsertWithEncryption,
  ConnectionSelect,
  ConnectionSelectWithEncryption,
  ConnectionUpdateWithEncryption
} from '../types/kysely/connection/connection.type'

const convert = (conn: ConnectionSelect): ConnectionSelectWithEncryption => {
  return {
    ...conn,
    connection_string: EncryptedField.fromEncryptedValue(conn.connection_string)
  }
}

export const getAll = async ({
  orgId,
  orgSlug,
  includeReadOnly
}: {
  orgId?: string
  orgSlug?: string
  includeReadOnly?: boolean
} = {}): Promise<ConnectionSelectWithEncryption[]> => {
  let query = getDb().selectFrom('connection')

  if (orgSlug) {
    query = query
      .innerJoin(
        'organization',
        'connection.organization_id',
        'organization.id'
      )
      .where('organization.slug', '=', orgSlug)
  }

  if (orgId) {
    query = query.where('organization_id', '=', orgId)
  }

  const conns = await query.selectAll('connection').execute()

  if (includeReadOnly) {
    return conns.map(convert)
  }

  const readOnlyConnIds = new Set()
  for (const conn of conns) {
    if (conn.readonly_connection_id) {
      readOnlyConnIds.add(conn.readonly_connection_id)
    }
  }

  return conns.filter(conn => !readOnlyConnIds.has(conn.id)).map(convert)
}

export const getById = async (
  id: string
): Promise<ConnectionSelectWithEncryption | undefined> => {
  if (!id.trim()) return undefined

  return getDb()
    .selectFrom('connection')
    .where('connection.id', '=', id)
    .selectAll()
    .executeTakeFirst()
    .then(conn => {
      if (!conn) return undefined
      return convert(conn)
    })
}

export const getByOrgAndDbSlug = async ({
  orgSlug,
  dbSlug
}: {
  orgSlug: string
  dbSlug: string
}): Promise<ConnectionSelectWithEncryption | undefined> => {
  if (!(orgSlug.trim() && dbSlug.trim())) return undefined

  return await getDb()
    .selectFrom('connection')
    .innerJoin(
      'metadata_database',
      'connection.id',
      'metadata_database.connection_id'
    )
    .innerJoin(
      'organization',
      'metadata_database.organization_id',
      'organization.id'
    )
    .where('metadata_database.slug', '=', dbSlug)
    .where('organization.slug', '=', orgSlug)
    .selectAll('connection')
    .executeTakeFirst()
    .then(conn => {
      if (!conn) return undefined
      return convert(conn)
    })
}

export const create = async (conn: ConnectionInsertWithEncryption) => {
  const insert = {
    ...conn,
    connection_string: await conn.connection_string.encrypt()
  }

  return await getDb()
    .insertInto('connection')
    .values(insert)
    .returningAll()
    .executeTakeFirstOrThrow()
    .then(convert)
}

export const removeConnection = async (id: string) => {
  if (id.trim() === '') {
    throw new Error('id cannot be empty.')
  }

  // Readonly connections cannot use ON DELETE CASCADE so we clean up manually.
  // If child, update the parent then remove the child.
  // If parent, get the child and delete both.

  return getDb()
    .transaction()
    .execute(async trx => {
      const maybeParent = await trx
        .selectFrom('connection')
        .select('id')
        .where('readonly_connection_id', '=', id)
        .executeTakeFirst()

      const childId = maybeParent ? id : undefined
      const isRemovingChild = !!childId

      if (isRemovingChild) {
        await getDb()
          .updateTable('connection')
          .set({ readonly_connection_id: null })
          .where('readonly_connection_id', '=', childId)
          .execute()

        return await getDb()
          .deleteFrom('connection')
          .where('id', '=', childId)
          .execute()
      }

      // removing parent
      const parent = await trx
        .selectFrom('connection')
        .select('readonly_connection_id')
        .where('id', '=', id)
        .executeTakeFirst()

      const ids = [id]
      if (parent?.readonly_connection_id)
        ids.push(parent.readonly_connection_id)

      return await getDb()
        .deleteFrom('connection')
        .where('id', 'in', ids)
        .execute()
    })
}

type UpdateableConnection = Pick<
  ConnectionUpdateWithEncryption,
  | 'name'
  | 'data_provider'
  | 'with_ssl'
  | 'connection_string'
  | 'visibility'
  | 'readonly_connection_id'
  | 'warehouse'
>

/**
 * Updates a connection.
 * @param id A connection entity id.
 * @param updates The key / values to update.
 */

export const updateById = async (
  id: string,
  updates: UpdateableConnection
): Promise<ConnectionSelectWithEncryption | undefined> => {
  if (id.trim() === '') {
    throw new Error('id cannot be empty.')
  }

  const keys = Object.keys(updates)
  if (keys.length === 0) {
    throw new Error('At least one field is required to update a connection.')
  }

  const set: Record<string, unknown> = {}
  for (const key of keys) {
    if (key === 'connection_string' && updates.connection_string) {
      set[key] = await updates.connection_string.encrypt()
    } else {
      set[key] = updates[key as keyof typeof updates]
    }
  }

  return await getDb()
    .updateTable('connection')
    .where('id', '=', id)
    .set(set)
    .returningAll()
    .executeTakeFirst()
    .then(conn => {
      if (!conn) return undefined
      return convert(conn)
    })
}

export const isReadOnlyConnection = async (id: string) => {
  return await getDb()
    .selectFrom('connection')
    .select('id')
    .where('readonly_connection_id', '=', id)
    .executeTakeFirst()
    .then(conn => !!conn)
}
