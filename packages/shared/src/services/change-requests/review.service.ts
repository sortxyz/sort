import { getDb } from '../../'

import {
  updateChangeRequestStatus,
  getChangeRequestById
} from './change-request.service'

import type { Review } from '../../schemas/review.schema'

export const getReviews = async (
  changeRequestId: string
): Promise<Review[]> => {
  try {
    return await getDb()
      .selectFrom('review')
      .selectAll()
      .where('change_request_id', '=', changeRequestId)
      .where('is_active', '=', true)
      .limit(100)
      .execute()
  } catch (error) {
    throw new Error('Failed to get reviews', { cause: error })
  }
}

export const getReview = async (reviewId: string) => {
  try {
    const review = await getDb()
      .selectFrom('review')
      .selectAll()
      .where('id', '=', reviewId)
      .executeTakeFirst()

    if (!review) {
      return null
    }

    return review
  } catch (error) {
    throw new Error('Failed to get review', { cause: error })
  }
}

export const createReview = async (
  reviewData: Omit<Review, 'is_active' | 'created_at' | 'updated_at'>
): Promise<Review> => {
  try {
    return await getDb()
      .transaction()
      .execute(async trx => {
        const userLastReview = await getDb()
          .selectFrom('review')
          .selectAll()
          .where('change_request_id', '=', reviewData.change_request_id)
          .where('created_by', '=', reviewData.created_by)
          .where('is_active', '=', true)
          .executeTakeFirst()

        await trx
          .updateTable('review')
          .set({ is_active: false })
          .where(eb =>
            eb.and({
              is_active: true,
              created_by: reviewData.created_by,
              change_request_id: reviewData.change_request_id
            })
          )
          .returningAll()
          .execute()

        const newReview = await trx
          .insertInto('review')
          .values({
            id: reviewData.id,
            change_request_id: reviewData.change_request_id,
            event_type: reviewData.event_type,
            text: reviewData.text || null,
            created_by: reviewData.created_by,
            is_active: true
          })
          .returningAll()
          .executeTakeFirstOrThrow()

        await trx
          .insertInto('change_request_history')
          .values({
            change_request_id: newReview.change_request_id,
            user_id: newReview.created_by,
            action_type: 'ADD_REVIEW',
            action_details: JSON.stringify({
              review_id: newReview.id,
              event_type: newReview.event_type,
              text: newReview.text || null
            }),
            created_at: new Date()
          })
          .execute()

        const changeRequest = await getChangeRequestById(
          reviewData.change_request_id,
          trx
        )

        if (
          changeRequest.status === 'open' &&
          newReview.event_type === 'APPROVE'
        ) {
          await updateChangeRequestStatus(trx, changeRequest.id, 'approved')
        }

        if (
          changeRequest.status === 'approved' &&
          newReview.event_type === 'COMMENT' &&
          userLastReview?.event_type === 'APPROVE'
        ) {
          await updateChangeRequestStatus(trx, changeRequest.id, 'open')
        }

        return newReview
      })
  } catch (error) {
    throw new Error('Failed to create review', { cause: error })
  }
}

export const updateReview = async (
  where: Pick<Review, 'id' | 'change_request_id'>,
  update: Pick<Review, 'text'>
): Promise<Review> => {
  try {
    return await getDb()
      .transaction()
      .execute(async trx => {
        const updatedReview = await trx
          .updateTable('review')
          .set({
            text: update.text || null
          })
          .where('id', '=', where.id)
          .returningAll()
          .executeTakeFirstOrThrow()

        await trx
          .insertInto('change_request_history')
          .values({
            change_request_id: where.change_request_id,
            user_id: updatedReview.created_by,
            action_type: 'UPDATE_REVIEW',
            action_details: JSON.stringify({
              review_id: updatedReview.id,
              event_type: updatedReview.event_type,
              text: updatedReview.text || null
            }),
            created_at: new Date()
          })
          .execute()

        return updatedReview
      })
  } catch (error) {
    throw new Error('Failed to update review', { cause: error })
  }
}
