import { randomUUID } from 'node:crypto'

import { getDb } from '../..'

import type { ChangeRequestComment } from '../../schemas/change-request-comment.schema'

type ChangeRequestCommentPayload = Omit<
  ChangeRequestComment,
  'created_by' | 'change_request_id'
>

export class ChangeRequestCommentMock {
  mocks: Partial<ChangeRequestComment>[] = []
  payloadIdMocks: string[] = []

  create(values: Partial<ChangeRequestComment> = {}) {
    const id = randomUUID()

    const mock = {
      id,
      change_request_id: randomUUID(),
      created_by: `user|${id}`,
      content: `Change Request Comment ${id}`,
      ...values
    }

    this.mocks.push(mock)

    return mock
  }

  createPayload(values: Partial<ChangeRequestCommentPayload> = {}) {
    const mock = {
      content: `Change Request Comment ${randomUUID()}`,
      ...values
    } as const

    return mock
  }

  addPayloadId(id: string) {
    this.payloadIdMocks.push(id)
  }

  async removeAll() {
    if (!this.mocks.length && !this.payloadIdMocks.length) return

    const mockIds = this.mocks.map(m => m.id).filter(Boolean)
    const ids = [...mockIds, ...this.payloadIdMocks]

    if (ids.length) {
      await getDb()
        .deleteFrom('change_request_comment')
        .where('id', 'in', ids as string[])
        .execute()

      this.mocks = []
      this.payloadIdMocks = []
    }
  }
}
