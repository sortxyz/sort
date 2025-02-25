import { randomUUID } from 'node:crypto'

import { getDb } from '../..'
import { toJSONB } from '../../utils/kysely.util'

import type { SortDB } from '../../types/kysely.type'
import type { Selectable } from 'kysely'

type ChangeRequestTest = Selectable<SortDB['test.change_request_test']>

export class ChangeRequestTestTableMock {
  mocks: ChangeRequestTest[] = []

  create(values: Partial<ChangeRequestTest> = {}) {
    const id = randomUUID()
    const date = new Date('2021-08-15')
    const mock = {
      id,
      test_uuid: null,
      test_numeric: '1.08',
      test_timestamp: date,
      test_date: date,
      test_timestamptz: date,
      test_boolean: true,
      test_jsonb: [4, '8', 15, '16', 23, 'forty-two'],
      test_text: 'https://lostpedia.fandom.com/wiki/The_Numbers',
      test_binary: Buffer.from('hello world'),
      ...values
    } satisfies ChangeRequestTest

    this.mocks.push(mock)

    return mock
  }

  async insert(values: ChangeRequestTest) {
    const row = {
      ...values,
      test_jsonb: toJSONB(values.test_jsonb)
    }

    const newResult = await getDb()
      .insertInto('test.change_request_test')
      .values(row)
      .returningAll()
      .executeTakeFirstOrThrow()

    return newResult
  }

  async update(values: Partial<ChangeRequestTest>, id: string) {
    const row = {
      ...values,
      test_jsonb: toJSONB(values.test_jsonb)
    }

    const newResult = await getDb()
      .updateTable('test.change_request_test')
      .set(row)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow()

    return newResult
  }

  async remove(id: string) {
    const newResult = await getDb()
      .deleteFrom('test.change_request_test')
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow()

    return newResult
  }

  async removeAll() {
    const ids = this.mocks.map(m => m.id)
    if (ids.length) {
      await getDb()
        .deleteFrom('test.change_request_test')
        .where('id', 'in', ids)
        .execute()

      this.mocks = []
    }
  }
}
