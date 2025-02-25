import { randomUUID } from 'node:crypto'

import { getDb } from '../'

import type { IssueComment } from '../schemas/issue-comment.schema'

type IssueCommentPayload = Omit<IssueComment, 'created_by' | 'issue_id'>

export class IssueCommentMock {
  mocks: Partial<IssueComment>[] = []
  payloadIdMocks: string[] = []

  create(values: Partial<IssueComment> = {}) {
    const id = randomUUID()

    const mock = {
      id,
      issue_id: randomUUID(),
      created_by: `user|${id}`,
      content: `Issue Comment ${id}`,
      ...values
    }

    this.mocks.push(mock)

    return mock
  }

  createPayload(values: Partial<IssueCommentPayload> = {}) {
    const mock = {
      content: `Issue Comment ${randomUUID()}`,
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
        .deleteFrom('issue_comment')
        .where('id', 'in', ids as string[])
        .execute()

      this.mocks = []
      this.payloadIdMocks = []
    }
  }
}
