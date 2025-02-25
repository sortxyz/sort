import { randomUUID } from 'node:crypto'

import { getDb } from '../..'

import type { SortDB } from '../../types/kysely.type'
import type { Selectable } from 'kysely'

type ChangeRequestTestUnsupportedTypes = Selectable<
  SortDB['test.change_request_test_unsupported_types']
>

export class ChangeRequestTestTableUnsupportedTypesMock {
  mocks: ChangeRequestTestUnsupportedTypes[] = []

  create(values: Partial<ChangeRequestTestUnsupportedTypes> = {}) {
    const id = randomUUID()
    const mock = {
      id,
      test_money: null,
      test_bytea: null,
      test_bit: null,
      test_bit_varying: null,
      test_boolean_array: null,
      test_box: null,
      test_circle: null,
      test_enum: null,
      test_inet: null,
      test_lseg: null,
      test_integer_array: null,
      test_integer_array_array: null,
      test_numeric_array: null,
      test_path: null,
      test_point: null,
      test_polygon: null,
      test_text_array: null,
      test_tsquery: null,
      test_tsvector: null,
      test_varbit: null,
      test_xml: null,
      ...values
    } satisfies ChangeRequestTestUnsupportedTypes

    this.mocks.push(mock)

    return mock
  }

  async insert(values: ChangeRequestTestUnsupportedTypes) {
    const newResult = await getDb()
      .insertInto('test.change_request_test_unsupported_types')
      .values(values)
      .returningAll()
      .executeTakeFirstOrThrow()

    return newResult
  }

  async removeAll() {
    const ids = this.mocks.map(m => m.id)
    if (ids.length) {
      await getDb()
        .deleteFrom('test.change_request_test_unsupported_types')
        .where('id', 'in', ids)
        .execute()

      this.mocks = []
    }
  }
}
