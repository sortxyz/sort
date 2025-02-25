import {
  randomUUID,
  scrypt as origScrypt,
  timingSafeEqual,
  webcrypto
} from 'node:crypto'
import { promisify } from 'node:util'

import { getDb } from '../'

import type { SortDB } from '../types/kysely.type'
import type { Transaction } from 'kysely'

const scrypt = <
  (
    password: string,
    salt: string,
    keylen: number,
    options: Record<string, unknown>
  ) => Promise<Buffer>
>promisify(origScrypt)

const createSalt = () => {
  const rand = webcrypto.getRandomValues(new Uint8Array(24))
  const buf = Buffer.from(rand)
  return buf.toString('base64')
}

const createKey = () => {
  const rand = webcrypto.getRandomValues(new Uint8Array(36))
  const buf = Buffer.from(rand)
  return buf.toString('base64')
}

const hash = async ({ salt, value }: { salt: string; value: string }) => {
  const normalizedSalt = salt.normalize()
  const normalizedValue = value.normalize()
  const keyLength = 64
  const parallelization = 5
  const options = { parallelization }

  const buf = await scrypt(normalizedValue, normalizedSalt, keyLength, options)
  return {
    normalizedSalt,
    normalizedValue,
    hash: buf.toString('base64'),
    buffer: buf
  }
}

/** We never show api keys to the public after their creation */
const publicFields = ['id', 'created_at', 'updated_at', 'summary'] as const

/**
 * Creates an API key for the given `userId`.
 *
 * If `salt`, `plainTextKey` or `rowId` are not provided, they will be
 * generated. These fields are meant to be used for testing purposes only.
 *
 * Note: No other api key method can return plain-text API keys
 * because they are one-way hashed before storage.
 **/
export const createAPIKey = async ({
  userId,
  summary,
  salt,
  plainTextKey,
  rowId,
  trx
}: {
  userId: string
  summary?: string
  salt?: string
  plainTextKey?: string
  rowId?: string
  trx?: Transaction<SortDB>
}) => {
  if (!rowId) rowId = randomUUID()
  if (!salt) salt = createSalt()
  if (!plainTextKey) plainTextKey = createKey()

  const hashResult = await hash({ salt, value: plainTextKey })
  const now = new Date()

  const row = {
    id: rowId,
    created_at: now,
    updated_at: now,
    summary: summary ?? null
  }

  await (trx || getDb())
    .insertInto('user_api_key')
    .values({
      ...row,
      user_id: userId,
      hash: `${hashResult.normalizedSalt}:${hashResult.hash}`
    })
    .executeTakeFirstOrThrow()

  return {
    ...row,
    api_key: `${Buffer.from(row.id).toString('base64')}.${plainTextKey}`
  }
}

/**
 * List all API keys for a user.
 */
export const listAPIKeys = async ({ userId }: { userId: string }) => {
  const result = await getDb()
    .selectFrom('user_api_key')
    .where('user_id', '=', userId)
    .select(publicFields)
    .execute()
  return result
}

/**
 * Delete an API key.
 *
 * Only the api key owner can delete.
 **/
export const deleteAPIKey = async ({
  id,
  userId
}: {
  id: string
  userId: string
}) => {
  await getDb()
    .deleteFrom('user_api_key')
    .where('id', '=', id)
    .where('user_id', '=', userId)
    .executeTakeFirst()
}

/**
 * Update an API key summary.
 *
 * Only the api key owner can update.
 **/
export const updateAPIKey = async ({
  id,
  userId,
  summary
}: {
  id: string
  userId: string
  summary: string | null
}) => {
  return await getDb()
    .updateTable('user_api_key')
    .set('summary', summary)
    .set('updated_at', new Date())
    .where('id', '=', id)
    .where('user_id', '=', userId)
    .returning(publicFields)
    .executeTakeFirstOrThrow()
}

/**
 * Fetch a user from the database by their API key.
 * @param apiKey Plain text API key
 * @returns The user object or `undefined` if not found
 */
export const getUserByAPIKey = async ({ apiKey }: { apiKey: string }) => {
  try {
    if (apiKey.trim().length === 0) return undefined

    const [base64id, plainTextKey] = apiKey.split('.')
    if (base64id.length === 0 || !plainTextKey || plainTextKey.length === 0) {
      return undefined
    }

    const id = Buffer.from(base64id, 'base64').toString('utf-8')

    const record = await getDb()
      .selectFrom('user')
      .innerJoin('user_api_key', 'user.id', 'user_api_key.user_id')
      .where('user_api_key.id', '=', id)
      .selectAll('user')
      .select(['user_api_key.hash'])
      .limit(1)
      .executeTakeFirst()

    if (!record?.hash?.length) return undefined

    // remove the internal api key hash from the user object
    const { hash: recordHash, ...user } = record

    const [storedSalt, storedHash] = recordHash.split(':')

    const incomingHash = await hash({ salt: storedSalt, value: plainTextKey })
    if (
      !timingSafeEqual(incomingHash.buffer, Buffer.from(storedHash, 'base64'))
    ) {
      return undefined
    }

    return user
  } catch (error) {
    throw new Error('Error retrieving user by api_key', {
      cause: error
    })
  }
}
