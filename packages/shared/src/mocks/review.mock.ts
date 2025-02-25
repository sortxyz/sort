import { randomUUID } from 'node:crypto'

import { getDb } from '../'
import * as ReviewService from '../services/change-requests/review.service'

import type { Review } from '../schemas/review.schema'

export class ReviewMock {
  mockIds: string[] = []

  create(values: Partial<Review> = {}) {
    const mock = {
      change_request_id: randomUUID(),
      event_type: 'COMMENT',
      created_by: `user|${randomUUID()}`,
      text: `Review text ${randomUUID()}`,
      created_at: new Date(),
      updated_at: new Date(),
      ...values
    } as const

    return mock
  }

  addMockId(id: string) {
    this.mockIds.push(id)
  }

  async createMockReview(partialReview: Partial<Review> = {}) {
    const mockReview = this.create(partialReview)

    const review = await ReviewService.createReview({
      ...mockReview,
      id: randomUUID()
    })

    this.addMockId(review.id)

    return review
  }

  async removeAll() {
    if (this.mockIds.length) {
      await getDb()
        .deleteFrom('review')
        .where('id', 'in', this.mockIds)
        .execute()

      this.mockIds = []
    }
  }
}
