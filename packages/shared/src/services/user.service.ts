import * as assert from 'node:assert'

import { getConfig, getDb } from '../'
import { pg7ErrorConditionCodes } from '../constants/database.constant'
import { DatabaseUniquenessError } from '../errors'
import { isErrnoException } from '../utils'

import { createClient } from './mailgun.service'

import type { Subscription } from '../schemas/subscription.schema'
import type { SortDB } from '../types/kysely.type'
import type { Nullable } from '../types/nullable.type'
import type { User } from '../types/user.type'
import type { Kysely } from 'kysely'

const getMailingListConfig = () => {
  const { MAILGUN_ALL_CUSTOMERS_LIST, MAILGUN_API_KEY } = getConfig()
  assert.ok(MAILGUN_API_KEY, 'MAILGUN_API_KEY is required')
  assert.ok(
    MAILGUN_ALL_CUSTOMERS_LIST,
    'MAILGUN_ALL_CUSTOMERS_LIST is required'
  )

  return {
    MAILGUN_ALL_CUSTOMERS_LIST,
    MAILGUN_API_KEY
  }
}

export const removeUserById = async (id: string) => {
  await getDb().deleteFrom('user').where('id', '=', id.trim()).execute()
}

/**
 * Creates the User in the database.
 * @throws {DatabaseUniquenessError} If the user already exists.
 * @throws {Error} for other failures.
 **/
export const createUser = async (
  user: User,
  administrator = false
): Promise<User> => {
  try {
    const result = await getDb()
      .insertInto('user')
      .values({
        id: user.id,
        username: user.username,
        username_discord: user.username_discord,
        name: user.name ?? null,
        email: user.email ?? null,
        email_verified: user.email_verified,
        picture: user.picture ?? null,
        administrator
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    return result
  } catch (error) {
    if (
      isErrnoException(error) &&
      error.code === pg7ErrorConditionCodes.UNIQUE_VIOLATION
    ) {
      throw new DatabaseUniquenessError('User already exists', {
        cause: error
      })
    }

    throw new Error('Error creating user', { cause: error })
  }
}

/**
 * Updates a user in the database.
 * @param user_id user id.
 * @param updates The key / values to update.
 */
export const updateUserById = async (
  user_id: string,
  updates: Partial<
    Pick<User, 'name' | 'username' | 'picture' | 'email' | 'email_verified'>
  >
): Promise<Nullable<User>> => {
  if (user_id.trim() === '') {
    throw new Error('user_id cannot be empty.')
  }

  const set: Partial<
    Pick<User, 'name' | 'username' | 'picture' | 'email' | 'email_verified'>
  > = {}

  if (updates.name?.trim()) {
    set.name = updates.name.trim()
  }

  if (updates.username?.trim()) {
    set.username = updates.username.trim()
  }

  if (updates.picture?.trim()) {
    set.picture = updates.picture.trim()
  }

  if (updates.email?.trim()) {
    set.email = updates.email.trim()
  }

  if (updates.email_verified !== undefined) {
    set.email_verified = !!updates.email_verified
  }

  if (!Object.keys(set).length) {
    throw new Error('At least one field is required to update your profile.')
  }

  try {
    const result = await getDb()
      .updateTable('user')
      .set(set)
      .where('id', '=', user_id.trim())
      .returningAll()
      .executeTakeFirst()

    return result ?? null
  } catch (error) {
    if (
      isErrnoException(error) &&
      error.code === pg7ErrorConditionCodes.UNIQUE_VIOLATION
    ) {
      throw new DatabaseUniquenessError('User exists', { cause: error })
    }

    throw new Error(`Error updating user with id: ${user_id}`, {
      cause: error
    })
  }
}

/**
 * Fetch a user from the database by their id.
 * @param apiKey The users API key.
 * @param where Optional object of column / value pairs to include in the `where` clause.
 */
export const getUserById = async (
  id: string,
  where?: Record<string, unknown>
) => {
  if (id.trim().length === 0) return undefined

  try {
    let builder = getDb().selectFrom('user').selectAll().where('id', '=', id)

    if (where) {
      builder = builder.where(eb => eb.and(where))
    }

    return await builder.executeTakeFirst()
  } catch (error) {
    throw new Error(`Error on trying to retrieve a user with id ${id}`, {
      cause: error
    })
  }
}

/**
 * Adds the given `email` to our customer mailing list. Duplicate emails are
 * safely ignored.
 *
 * If the `email` was a duplicate, `added` will be `false`,
 * otherwise `true`.
 *
 * If an error occurs while adding the `email` to the list, it will be thrown.
 */
export const addToCustomerMailingList = async (user: User) => {
  assert.ok(
    user.email,
    'User must have an email to be added to the mailing list'
  )

  const { MAILGUN_ALL_CUSTOMERS_LIST, MAILGUN_API_KEY } = getMailingListConfig()

  try {
    await createClient(MAILGUN_API_KEY).lists.members.createMember(
      MAILGUN_ALL_CUSTOMERS_LIST,
      {
        address: user.email,
        name: user.name ?? '',
        subscribed: 'yes'
      }
    )

    return { added: true }
  } catch (error) {
    const { status, details } = error as Error & {
      status?: number
      details?: string
    }

    if (status === 400 && /address already exists/i.test(details ?? '')) {
      return { added: false }
    }

    throw error
  }
}

export const removeFromCustomerMailingList = async (user: User) => {
  assert.ok(user.email, 'User must have an email address')

  const { MAILGUN_ALL_CUSTOMERS_LIST, MAILGUN_API_KEY } = getMailingListConfig()

  try {
    await createClient(MAILGUN_API_KEY).lists.members.destroyMember(
      MAILGUN_ALL_CUSTOMERS_LIST,
      user.email
    )
  } catch (error) {
    const { status, details } = error as Error & {
      status?: number
      details?: string
    }

    if (status === 404 && /Member .+ not found/i.test(details ?? '')) {
      return
    }

    throw error
  }
}

export const getMailingListSubscriptions = async (user: User) => {
  if (!(user.email && user.email_verified)) {
    return []
  }

  const { MAILGUN_ALL_CUSTOMERS_LIST, MAILGUN_API_KEY } = getMailingListConfig()

  try {
    const result = await createClient(MAILGUN_API_KEY).lists.members.getMember(
      MAILGUN_ALL_CUSTOMERS_LIST,
      user.email
    )

    return [
      {
        name: 'newsletter',
        email: user.email,
        subscribed: result.subscribed
      } as Subscription
    ]
  } catch (error) {
    const { status, details } = error as Error & {
      status?: number
      details?: string
    }

    if (status === 404 && /Member .+ not found/i.test(details ?? '')) {
      return [
        {
          name: 'newsletter',
          email: user.email,
          subscribed: false
        } as Subscription
      ]
    }

    throw error
  }
}

/**
 * Sets:
 *   1. The current time as their Terms of Use acceptance date
 *   2. Increments the number of times they logged in
 */
export const trackLogin = async (user: User) => {
  try {
    return await getDb()
      .updateTable('user')
      .where('id', '=', user.id)
      .set(eb => ({
        login_count: eb('login_count', '+', 1),
        terms_accepted_at: new Date()
      }))
      .returningAll()
      .executeTakeFirstOrThrow()
  } catch (error) {
    throw new Error(`Error trying to trackLogin of user "${user.id}"`, {
      cause: error
    })
  }
}

export const getUserByEmail = async (db: Kysely<SortDB>, email: string) => {
  return await db
    .selectFrom('user')
    .where('email', '=', email)
    .limit(1)
    .selectAll()
    .executeTakeFirstOrThrow()
}

/** Fetches the Sort UI service account */
export const getSortUISvcUser = async (
  db: Kysely<SortDB>,
  config: { SORTUI_SERVICE_ACCOUNT_EMAIL: string }
) => {
  return await getUserByEmail(db, config.SORTUI_SERVICE_ACCOUNT_EMAIL)
}

/** Fetches the public Sort bot service account */
export const getSortBotSvcUser = async (
  db: Kysely<SortDB>,
  config: { SORT_PUBLIC_BOT_SERVICE_ACCOUNT_EMAIL: string }
) => {
  return await getUserByEmail(db, config.SORT_PUBLIC_BOT_SERVICE_ACCOUNT_EMAIL)
}
