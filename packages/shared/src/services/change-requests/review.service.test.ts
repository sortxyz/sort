import { randomUUID } from 'node:crypto'

import {
  createKysely,
  disconnectKysely,
  getDb,
  getConfig,
  logger
} from '../../'
import { uuidFormat } from '../../constants/type-mask.constant'
import { ChangeRequestMock } from '../../mocks/change-requests/change-request.mock'
import { ConnectionMock } from '../../mocks/connection.mock'
import { MetadataDatabaseMock } from '../../mocks/metadata.mock'
import { OrganizationMock } from '../../mocks/org.mock'
import { ReviewMock } from '../../mocks/review.mock'
import { UserMock } from '../../mocks/user.mock'
import * as ConnectionService from '../connection.service'
import * as MetadataDatabaseService from '../kysely/metadata/database.service'
import * as OrganizationService from '../org.service'
import * as UserService from '../user.service'

import * as ChangeRequestService from './change-request.service'
import * as ReviewService from './review.service'

import type { FullChangeRequestResponse } from '../../schemas/change-request.schema'
import type { Review } from '../../schemas/review.schema'
import type { User } from '../../types/user.type'

describe('review.service', () => {
  const userMock = new UserMock()
  const orgMock = new OrganizationMock()
  const dbMock = new MetadataDatabaseMock()
  const connMock = new ConnectionMock()
  const changeRequestMock = new ChangeRequestMock()
  const reviewMock = new ReviewMock()

  const nonOrgUser1 = userMock.create()
  const nonOrgUser2 = userMock.create()
  const orgAdminUser = userMock.create()
  const orgMemberUser1 = userMock.create()
  const orgMemberUser2 = userMock.create()
  const org = orgMock.create({ created_by: orgAdminUser.id })
  const prvConn = connMock.create({
    organization_id: org.id,
    created_by: orgAdminUser.id
  })
  const pubConn = connMock.create({
    organization_id: org.id,
    visibility: 'public',
    created_by: orgAdminUser.id
  })
  const prvDbEntry = dbMock.create({
    organization_id: org.id,
    connection_id: prvConn.id
  })
  const pubDbEntry = dbMock.create({
    organization_id: org.id,
    connection_id: pubConn.id
  })

  async function setupTests() {
    await UserService.createUser(orgAdminUser)
    await UserService.createUser(nonOrgUser1)
    await UserService.createUser(nonOrgUser2)
    await UserService.createUser(orgMemberUser1)
    await UserService.createUser(orgMemberUser2)
    await OrganizationService.create(org)
    await OrganizationService.addMember(org.slug, orgMemberUser1.id, 'member')
    await OrganizationService.addMember(org.slug, orgMemberUser2.id, 'member')
    await ConnectionService.create(prvConn)
    await ConnectionService.create(pubConn)
    await MetadataDatabaseService.insertMetadataDb(getDb(), prvDbEntry)
    await MetadataDatabaseService.insertMetadataDb(getDb(), pubDbEntry)
  }

  async function cleanupTests() {
    await reviewMock.removeAll()
    await changeRequestMock.removeAll()
    await connMock.removeAll()
    await dbMock.removeAll()
    await orgMock.removeAll(true)
    await userMock.removeAll()
  }

  beforeAll(async () => {
    createKysely({ config: getConfig(), sortLogger: logger })
    await setupTests()
  })

  beforeEach(async () => {
    jest.resetAllMocks()
  })

  afterEach(async () => {
    await reviewMock.removeAll()
    await changeRequestMock.removeAll()
  })

  afterAll(async () => {
    await cleanupTests()
    await disconnectKysely()
  })

  const createMockChangeRequest = async (
    createdBy: User,
    visibility: 'public' | 'private'
  ) => {
    const connection = visibility === 'public' ? pubConn : prvConn
    const database = visibility === 'public' ? pubDbEntry : prvDbEntry

    const mockChangeRequest = changeRequestMock.create({
      created_by: createdBy.id,
      connection_id: connection.id,
      database_name: database.raw_name
    })

    return await ChangeRequestService.createChangeRequest(mockChangeRequest)
  }

  describe('getReviews', () => {
    let changeRequest: FullChangeRequestResponse
    let firstReview: Review

    beforeEach(async () => {
      changeRequest = await createMockChangeRequest(orgMemberUser1, 'public')

      firstReview = await reviewMock.createMockReview({
        change_request_id: changeRequest.id,
        created_by: orgMemberUser2.id,
        event_type: 'COMMENT'
      })
    })

    it('should return an empty array if there are no reviews for the given change request', async () => {
      const nonExistentReviewId = randomUUID()
      const emptyReviews = await ReviewService.getReviews(nonExistentReviewId)
      expect(emptyReviews).toEqual([])
    })

    it('should return an array of reviews for a given change request', async () => {
      let reviews = await ReviewService.getReviews(changeRequest.id)
      expect(reviews).toEqual([firstReview])

      const secondReview = await reviewMock.createMockReview({
        change_request_id: changeRequest.id,
        created_by: orgMemberUser1.id,
        event_type: 'APPROVE'
      })
      reviews = await ReviewService.getReviews(changeRequest.id)
      expect(reviews).toEqual([firstReview, secondReview])
    })

    it('should return only the first 100 reviews', async () => {
      for (let i = 0; 102 > i; i++) {
        const mockUser = userMock.create()
        const user = await UserService.createUser(mockUser)
        await OrganizationService.addMember(org.slug, user.id, 'member')

        await reviewMock.createMockReview({
          change_request_id: changeRequest.id,
          created_by: user.id,
          event_type: i % 2 === 1 ? 'COMMENT' : 'APPROVE'
        })
      }

      const reviews = await ReviewService.getReviews(changeRequest.id)

      expect(reviews).toBeDefined()
      expect(reviews).toHaveLength(100)
    })

    it('should throw an error if the database query fails', async () => {
      jest.spyOn(getDb(), 'selectFrom').mockImplementation(() => {
        throw new Error('Failed to get reviews')
      })

      await expect(ReviewService.getReviews(changeRequest.id)).rejects.toThrow(
        'Failed to get reviews'
      )
    })

    it('should throw an error if an invalid change request ID is provided', async () => {
      const invalidChangeRequestId = 'invalid-id'
      try {
        await ReviewService.getReviews(invalidChangeRequestId)

        fail(
          'Expected getReviews to fail with invalid change request ID provided'
        )
      } catch (error) {
        if (!(error instanceof Error)) {
          fail('Caught error is not of type Error')
        }

        expect(error.message).toBe('Failed to get reviews')
      }
    })
  })

  describe('getReview', () => {
    let changeRequest: FullChangeRequestResponse
    let firstReview: Review

    beforeEach(async () => {
      changeRequest = await createMockChangeRequest(orgMemberUser1, 'public')

      firstReview = await reviewMock.createMockReview({
        change_request_id: changeRequest.id,
        created_by: orgMemberUser2.id,
        event_type: 'COMMENT'
      })
    })

    it('should return null if the review does not exist', async () => {
      const nonExistentReviewId = randomUUID()
      const review = await ReviewService.getReview(nonExistentReviewId)
      expect(review).toBeNull()
    })

    it('should return a review for a given review id', async () => {
      const review = await ReviewService.getReview(firstReview.id)
      expect(review).toEqual(firstReview)
    })

    it('should throw an error if the database query fails', async () => {
      jest.spyOn(getDb(), 'selectFrom').mockImplementation(() => {
        throw new Error('Failed to get review')
      })

      await expect(ReviewService.getReview(firstReview.id)).rejects.toThrow(
        'Failed to get review'
      )
    })

    it('should throw an error if an invalid change request ID is provided', async () => {
      const invalidReviewId = 'invalid-id'
      try {
        await ReviewService.getReview(invalidReviewId)

        fail('Expected getReview to fail with invalid review ID provided')
      } catch (error) {
        if (!(error instanceof Error)) {
          fail('Caught error is not of type Error')
        }

        expect(error.message).toBe('Failed to get review')
      }
    })
  })

  describe('createReview', () => {
    let changeRequest: FullChangeRequestResponse
    let firstMockReview: Omit<
      Review,
      'is_active' | 'id' | 'created_at' | 'updated_at'
    >
    let firstReview: Review

    beforeEach(async () => {
      changeRequest = await createMockChangeRequest(orgMemberUser1, 'public')

      firstMockReview = {
        change_request_id: changeRequest.id,
        created_by: orgMemberUser2.id,
        event_type: 'COMMENT',
        text: 'First review text'
      }
      firstReview = await ReviewService.createReview({
        ...firstMockReview,
        id: randomUUID()
      })
      reviewMock.addMockId(firstReview.id)
    })

    it('should create a review', async () => {
      expect(firstReview).toEqual({
        id: expect.stringMatching(uuidFormat),
        change_request_id: firstMockReview.change_request_id,
        event_type: firstMockReview.event_type,
        text: firstMockReview.text,
        created_by: firstMockReview.created_by,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
        is_active: true
      })
    })

    it('should emit ADD_REVIEW events on review creation', async () => {
      const events = await getDb()
        .selectFrom('change_request_history')
        .selectAll()
        .where('change_request_id', '=', changeRequest.id)
        .execute()

      expect(events).toHaveLength(2)
      expect(events[1]).toEqual({
        id: expect.any(String),
        change_request_id: changeRequest.id,
        user_id: orgMemberUser2.id,
        action_type: 'ADD_REVIEW',
        action_details: {
          review_id: firstReview.id,
          event_type: firstReview.event_type,
          text: firstReview.text
        },
        created_at: expect.any(Date)
      })
    })

    it('should allow a reviewer to create multiple reviews of the same change request', async () => {
      const secondMockReview = reviewMock.create({
        change_request_id: changeRequest.id,
        created_by: orgMemberUser2.id,
        event_type: 'APPROVE'
      })

      const secondReview = await ReviewService.createReview({
        ...secondMockReview,
        id: randomUUID()
      })

      expect(secondReview).toEqual({
        id: expect.any(String),
        change_request_id: secondMockReview.change_request_id,
        event_type: secondMockReview.event_type,
        text: secondMockReview.text,
        created_by: secondMockReview.created_by,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
        is_active: true
      })

      reviewMock.addMockId(secondReview.id)
    })

    it('should update the is_active flag of existing reviews by the same reviewer on the same change request when a new review is created by that reviewer', async () => {
      const secondMockReview = reviewMock.create({
        change_request_id: changeRequest.id,
        created_by: orgMemberUser2.id,
        event_type: 'APPROVE'
      })

      const secondReview = await ReviewService.createReview({
        ...secondMockReview,
        id: randomUUID()
      })

      reviewMock.addMockId(secondReview.id)

      // TODO: Use ReviewService.getReviews once implemented
      const allReviews = await getDb()
        .selectFrom('review')
        .selectAll()
        .where('change_request_id', '=', changeRequest.id)
        .execute()

      expect(allReviews).toEqual([
        {
          ...firstReview,
          created_by: orgMemberUser2.id,
          is_active: false
        },
        {
          ...secondReview,
          created_by: orgMemberUser2.id,
          is_active: true
        }
      ])
    })

    it('should update the change request status to "APPROVED" if the reviewer approves the change request', async () => {
      const approveMockReview = reviewMock.create({
        change_request_id: changeRequest.id,
        created_by: orgMemberUser2.id,
        event_type: 'APPROVE'
      })

      await ReviewService.createReview({
        ...approveMockReview,
        id: randomUUID()
      })

      const updatedChangeRequest =
        await ChangeRequestService.getFullChangeRequestResponse({
          org_slug: org.slug,
          connection_id: changeRequest.connection_id,
          database_name: changeRequest.database_name,
          change_request_number: changeRequest.change_request_number
        })

      expect(updatedChangeRequest).toEqual({
        id: changeRequest.id,
        connection_id: changeRequest.connection_id,
        database_name: changeRequest.database_name,
        title: changeRequest.title,
        description: changeRequest.description,
        change_request_number: changeRequest.change_request_number,
        status: 'approved',
        changes: [],
        related_issues: [],
        labels: changeRequest.labels,
        reviewers: changeRequest.reviewers,
        created_by: changeRequest.created_by,
        created_at: changeRequest.created_at,
        updated_at: expect.any(Date)
      })
    })

    it('should update the change request status to "OPEN" if the reviewer comments on the change request when it has been previously approved', async () => {
      const approveMockReview = reviewMock.create({
        change_request_id: changeRequest.id,
        created_by: orgMemberUser2.id,
        event_type: 'APPROVE'
      })
      const approvedReview = await ReviewService.createReview({
        ...approveMockReview,
        id: randomUUID()
      })
      reviewMock.addMockId(approvedReview.id)

      const openMockReview = reviewMock.create({
        change_request_id: changeRequest.id,
        created_by: orgMemberUser2.id,
        event_type: 'COMMENT'
      })
      const openReview = await ReviewService.createReview({
        ...openMockReview,
        id: randomUUID()
      })
      reviewMock.addMockId(openReview.id)

      const updatedChangeRequest =
        await ChangeRequestService.getFullChangeRequestResponse({
          org_slug: org.slug,
          connection_id: changeRequest.connection_id,
          database_name: changeRequest.database_name,
          change_request_number: changeRequest.change_request_number
        })

      expect(updatedChangeRequest).toEqual({
        id: changeRequest.id,
        connection_id: changeRequest.connection_id,
        database_name: changeRequest.database_name,
        title: changeRequest.title,
        description: changeRequest.description,
        change_request_number: changeRequest.change_request_number,
        status: 'open',
        changes: [],
        related_issues: [],
        labels: changeRequest.labels,
        reviewers: changeRequest.reviewers,
        created_by: changeRequest.created_by,
        created_at: changeRequest.created_at,
        updated_at: expect.any(Date)
      })
    })
  })

  describe('updateReview', () => {
    let changeRequest: FullChangeRequestResponse
    let firstReview: Review

    beforeEach(async () => {
      changeRequest = await createMockChangeRequest(orgMemberUser1, 'public')

      firstReview = await reviewMock.createMockReview({
        change_request_id: changeRequest.id,
        created_by: orgMemberUser2.id,
        event_type: 'COMMENT'
      })
    })

    it('should update a review', async () => {
      const updatedReview = await ReviewService.updateReview(
        {
          id: firstReview.id,
          change_request_id: firstReview.change_request_id
        },
        {
          text: 'Updated review text'
        }
      )

      expect(updatedReview).toEqual({
        id: firstReview.id,
        change_request_id: firstReview.change_request_id,
        event_type: 'COMMENT',
        text: 'Updated review text',
        created_by: firstReview.created_by,
        created_at: firstReview.created_at,
        updated_at: expect.any(Date),
        is_active: true
      })
    })

    it('should emit UPDATE_REVIEW events on review update', async () => {
      await ReviewService.updateReview(
        {
          id: firstReview.id,
          change_request_id: firstReview.change_request_id
        },
        {
          text: 'Updated review text'
        }
      )

      const events = await getDb()
        .selectFrom('change_request_history')
        .selectAll()
        .where('change_request_id', '=', changeRequest.id)
        .orderBy('created_at', 'asc')
        .execute()

      expect(events).toHaveLength(3)
      expect(events[2]).toEqual({
        id: expect.any(String),
        change_request_id: changeRequest.id,
        user_id: orgMemberUser2.id,
        action_type: 'UPDATE_REVIEW',
        action_details: {
          review_id: firstReview.id,
          event_type: firstReview.event_type,
          text: 'Updated review text'
        },
        created_at: expect.any(Date)
      })
    })

    it('should throw an error if the review does not exist', async () => {
      const nonExistentReviewId = randomUUID()
      try {
        await ReviewService.updateReview(
          {
            id: nonExistentReviewId,
            change_request_id: firstReview.change_request_id
          },
          {
            text: 'Updated review text'
          }
        )

        fail('Expected updateReview to fail with invalid review ID provided')
      } catch (error) {
        if (!(error instanceof Error)) {
          fail('Caught error is not of type Error')
        }

        expect(error.message).toBe('Failed to update review')
      }
    })

    it('should throw an error if an invalid change request ID is provided', async () => {
      const invalidReviewId = 'invalid-id'
      try {
        await ReviewService.updateReview(
          {
            id: invalidReviewId,
            change_request_id: firstReview.change_request_id
          },
          {
            text: 'Updated review text'
          }
        )

        fail('Expected updateReview to fail with invalid review ID provided')
      } catch (error) {
        if (!(error instanceof Error)) {
          fail('Caught error is not of type Error')
        }

        expect(error.message).toBe('Failed to update review')
      }
    })
  })
})
