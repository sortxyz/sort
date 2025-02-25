import { getConfig, getDb } from '../'

import type { SortDB } from '../types/kysely.type'
import type { User } from '../types/user.type'
import type { Selectable } from 'kysely'

type SortUser = Selectable<SortDB['user']>

const createUser = (values: Partial<SortUser> = {}) => {
  const id = String(Math.random())

  const mock = {
    id: `user|${id}`,
    username: `user-${id}`,
    username_discord: null,
    administrator: false,
    name: `name ${id}`,
    email: `test-email-${id}@sort.xyz`,
    picture: `https://sort.xyz/favicon.png?${id}`,
    password_reset_at: null,
    terms_accepted_at: null,
    login_count: 0,
    email_verified: false,
    ...values
  } satisfies SortUser

  return mock
}

export class UserMock {
  mocks: SortUser[] = []

  create(values: Partial<SortUser> = {}) {
    const mock = createUser(values)
    this.mocks.push(mock)
    return mock
  }

  createSorthubServiceAccount(values: Partial<SortUser> = {}) {
    return this.create({
      ...values,
      email: getConfig().SORTUI_SERVICE_ACCOUNT_EMAIL
    })
  }

  async removeAll(): Promise<void> {
    const ids = this.mocks.map(m => m.id)
    if (!ids.length) return
    await getDb().deleteFrom('user').where('id', 'in', ids).execute()
  }
}

/**
 * @deprecated Please import `UserMock` instead.
 */
export const userMock = {
  id: 'auth0|62e4b12143e9885859dcf15d',
  username: 'awesome-clam457',
  username_discord: null,
  name: 'Awesome Clam',
  email: 'test-email-808@sort.xyz',
  email_verified: false,
  picture: 'https://sort.xyz/favicon.png',
  administrator: false
} satisfies User
