import { randomUUID } from 'node:crypto'

import { getDb } from '../'

import type { Issue } from '../schemas/issue.schema'

type IssuePayload = Omit<
  Partial<Issue>,
  'labels' | 'assignees' | 'related_change_requests'
> & {
  labels: string[]
  assignees: string[]
  related_change_requests: number[]
}

export class IssueMock {
  mocks: Partial<Issue>[] = []
  payloadMockIds: string[] = []

  create(values: Partial<Issue> = {}) {
    const id = randomUUID()

    const mock = {
      id,
      connection_id: randomUUID(),
      database_name: `raw-db-${id}`,
      created_by: `user|${id}`,
      title: `Issue Title ${id}`,
      labels: values.labels || [],
      assignees: values.assignees || [],
      related_change_requests: values.related_change_requests || [],
      ...values
    } as Issue

    this.mocks.push(mock)

    return mock
  }

  createPayload(values: Partial<IssuePayload> = {}) {
    const id = randomUUID()

    const mock = {
      created_by: `user|${id}`,
      title: `Issue Title ${id}`,
      labels: values.labels || [],
      assignees: values.assignees || [],
      related_change_requests: values.related_change_requests || [],
      ...values
    } as const

    return mock
  }

  addPayloadId(id: string) {
    this.payloadMockIds.push(id)
  }

  async removeAll() {
    if (!this.mocks.length && !this.payloadMockIds.length) return

    const mockIds = this.mocks
      .map(m => m.id)
      .filter((id): id is string => id !== undefined)

    const payloadMockIds = this.payloadMockIds.filter(
      (id): id is string => id !== undefined
    )

    const ids: string[] = [...mockIds, ...payloadMockIds]

    if (ids.length) {
      await getDb()
        .deleteFrom('issue_history')
        .where('issue_id', 'in', ids)
        .execute()

      await getDb().deleteFrom('issue').where('id', 'in', ids).execute()
    }

    this.mocks = []
    this.payloadMockIds = []
  }
}
