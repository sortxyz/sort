import { randomUUID } from 'node:crypto'

import { getDb } from '../bootstrap'

import type { SortDB } from '../types/kysely.type'
import type { Selectable } from 'kysely'

type APIKey = Selectable<SortDB['user_api_key']> & { api_key?: string }

const createAPIKeyMock = (values: Partial<APIKey> = {}) => {
  const uuid = randomUUID()

  const mock = {
    id: uuid,
    user_id: `user|${uuid}`,
    api_key: 'fake-test.key',
    hash: 'fake-hashed-key:asRdzRsdf9asdfa03iw9Ghisavnir0ah4hak',
    summary: 'Test API Key',
    created_at: new Date(),
    updated_at: new Date(),
    ...values
  } satisfies APIKey

  return mock
}

export class APIKeyMock {
  ids: string[] = []

  create(values: Partial<APIKey> = {}) {
    const mock = createAPIKeyMock(values)
    this.addId(mock.id)
    return mock
  }

  async removeAll() {
    if (this.ids.length === 0) return

    await getDb()
      .deleteFrom('user_api_key')
      .where('id', 'in', this.ids)
      .execute()

    this.ids = []
  }

  addId(id: string) {
    this.ids.push(id)
  }
}
