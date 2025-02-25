import { randomUUID } from 'crypto'

import { getDb } from '../..'

import type { ChangeRequestJob } from '../../schemas/change-request-job.schema'

export class ChangeRequestJobMock {
  mocks: ChangeRequestJob[] = []

  create(data: Partial<ChangeRequestJob>) {
    const id = randomUUID()

    const mock = {
      id,
      change_request_id: randomUUID(),
      status: 'PENDING',
      start_time: new Date(),
      end_time: new Date(),
      error_message: '',
      rows_affected: 1,
      created_at: new Date(),
      updated_at: new Date(),
      ...data
    }

    this.mocks.push(mock)

    return mock
  }

  async removeAll() {
    if (!this.mocks.length) return

    const ids = this.mocks
      .map(m => m.id)
      .filter((id): id is string => id !== undefined)

    await getDb()
      .deleteFrom('change_request_job')
      .where('id', 'in', ids)
      .execute()

    this.mocks = []
  }
}
