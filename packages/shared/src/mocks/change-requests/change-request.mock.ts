import { randomUUID } from 'node:crypto'

import { getDb } from '../..'

import type { CreateChangeRequestBody } from '../../schemas/change-request.schema'
import type { createChangeRequest } from '../../services/change-requests/change-request.service'

type CreateChangeRequestArg = Parameters<typeof createChangeRequest>[0]

export class ChangeRequestMock {
  mocks: Partial<CreateChangeRequestArg>[] = []
  payloadMockIds: string[] = []

  create(values: Partial<CreateChangeRequestArg> = {}) {
    const id = randomUUID()

    const mock = {
      id,
      connection_id: randomUUID(),
      database_name: `raw-db-${id}`,
      created_by: `user|${id}`,
      title: `Change Request Title ${id}`,
      labels: values.labels || [],
      reviewers: values.reviewers || [],
      changes: values.changes || [],
      related_issues: values.related_issues || [],
      ...values
    } as const

    this.mocks.push(mock)

    return mock
  }

  createPayload(values: Partial<CreateChangeRequestBody> = {}) {
    const id = randomUUID()

    const mock = {
      title: `Change Request Title ${id}`,
      labels: values.labels || [],
      reviewers: values.reviewers || [],
      ...values
    } satisfies CreateChangeRequestBody

    return mock
  }

  addPayloadId(id: string) {
    if (id) {
      this.payloadMockIds.push(id)
    }
  }

  async removeAll() {
    if (!this.mocks.length && !this.payloadMockIds.length) return

    const mockIds = this.mocks
      .map(m => m.id)
      .filter((id): id is string => id !== undefined)

    const payloadMockIds = this.payloadMockIds

    const ids: string[] = [...mockIds, ...payloadMockIds]

    if (ids.length) {
      await getDb()
        .deleteFrom('change_request_history')
        .where('change_request_id', 'in', ids)
        .execute()

      await getDb()
        .deleteFrom('change_request')
        .where('id', 'in', ids)
        .execute()
    }

    this.mocks = []
    this.payloadMockIds = []
  }
}
