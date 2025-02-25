import { randomUUID } from 'node:crypto'

import { getDb } from '../..'

import type {
  Change,
  ChangeFieldValue,
  ChangePrimaryKey
} from '../../schemas/change.schema'

export class ChangeMock {
  changeMocks: Change[] = []
  changeFieldValueMocks: ChangeFieldValue[] = []
  changePrimaryKeyMocks: ChangePrimaryKey[] = []

  create(values: Partial<Change> = {}) {
    const id = randomUUID()

    const mock = {
      id,
      change_request_id: randomUUID(),
      index: 0,
      action: 'ADD',
      connection_id: randomUUID(),
      metadata_database_name: 'sort_xyz',
      metadata_schema_name: 'test',
      metadata_table_name: 'change_request_test',
      ...values
    } as const

    this.changeMocks.push(mock)

    return mock
  }

  createFieldValue(values: Partial<ChangeFieldValue> = {}) {
    const id = randomUUID()

    // simple id insertion into our test table
    const mock = {
      id,
      change_id: randomUUID(),
      column_name: 'id',
      string_value: randomUUID(),
      numeric_value: undefined,
      date_value: undefined,
      boolean_value: undefined,
      json_value: undefined,
      uuid_value: undefined,
      is_value_null: false,
      ...values
    } satisfies ChangeFieldValue

    this.changeFieldValueMocks.push(mock)

    return mock
  }

  createPrimaryKey(values: Partial<ChangePrimaryKey> = {}) {
    const id = randomUUID()

    // simple id insertion into our test table
    const mock = {
      id,
      change_id: randomUUID(),
      column_name: 'id',
      string_value: randomUUID(),
      numeric_value: undefined,
      date_value: undefined,
      boolean_value: undefined,
      json_value: undefined,
      uuid_value: undefined,
      ...values
    } satisfies ChangePrimaryKey

    this.changePrimaryKeyMocks.push(mock)

    return mock
  }

  async removeAll() {
    if (
      !this.changeFieldValueMocks.length &&
      !this.changePrimaryKeyMocks.length
    )
      return

    if (this.changeMocks.length) {
      await getDb()
        .deleteFrom('change')
        .where(
          'id',
          'in',
          this.changeMocks.map(m => m.id)
        )
        .execute()

      if (this.changeFieldValueMocks.length) {
        await getDb()
          .deleteFrom('change_field_value')
          .where(
            'id',
            'in',
            this.changeFieldValueMocks.map(m => m.id)
          )
          .execute()
      }

      if (this.changePrimaryKeyMocks.length) {
        await getDb()
          .deleteFrom('change_primary_key')
          .where(
            'id',
            'in',
            this.changePrimaryKeyMocks.map(m => m.id)
          )
          .execute()
      }
    }

    this.changeMocks = []
    this.changeFieldValueMocks = []
    this.changePrimaryKeyMocks = []
  }
}
