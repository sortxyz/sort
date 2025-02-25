import { randomUUID } from 'node:crypto'

import { getDb } from '../..'
import { toJSONB } from '../../utils/kysely.util'

import type { SortDB } from '../../types/kysely.type'
import type { Selectable } from 'kysely'

type ChangeRequestTestAllPrimaryKeys = Selectable<
  SortDB['test.change_request_test_all_primary_keys']
>

export class ChangeRequestTestAllPrimaryKeysTableMock {
  mockIds: string[] = []

  create(values: Partial<ChangeRequestTestAllPrimaryKeys> = {}) {
    const id = randomUUID()
    const date = new Date('2021-08-15')
    const mock = {
      id,
      binary_id: Buffer.from('hello world'),
      boolean_id: true,
      jsonb_id: [4, '8', 15, '16', 23, 'forty-two'],
      numeric_id: '1.08',
      timestamp_id: date,
      ...values
    } satisfies ChangeRequestTestAllPrimaryKeys

    this.mockIds.push(mock.id)

    return mock
  }

  async addId(id: string) {
    this.mockIds.push(id)
  }

  async insert(values: ChangeRequestTestAllPrimaryKeys) {
    const row = {
      ...values,
      jsonb_id: toJSONB(values.jsonb_id)
    }

    const newResult = await getDb()
      .insertInto('test.change_request_test_all_primary_keys')
      .values(row)
      .returningAll()
      .executeTakeFirstOrThrow()

    return newResult
  }

  async removeAll() {
    if (this.mockIds.length) {
      // uuids are unique, so we can delete by them, but the key here is technically the entire row
      await getDb()
        .deleteFrom('test.change_request_test_all_primary_keys')
        .where('id', 'in', this.mockIds)
        .execute()

      this.mockIds = []
    }
  }
}
