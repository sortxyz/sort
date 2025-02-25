import { randomUUID } from 'node:crypto'

import { dateFormat } from '@sort/shared/constants/type-mask.constant'
import { ChangeRequestMock } from '@sort/shared/mocks/change-requests/change-request.mock'
import { ConnectionMock } from '@sort/shared/mocks/connection.mock'
import { LabelMock } from '@sort/shared/mocks/label.mock'
import { MetadataDatabaseMock } from '@sort/shared/mocks/metadata.mock'
import { OrganizationMock } from '@sort/shared/mocks/org.mock'
import { ReviewMock } from '@sort/shared/mocks/review.mock'
import { UserMock } from '@sort/shared/mocks/user.mock'
import * as ChangeRequestService from '@sort/shared/services/change-requests/change-request.service'
import * as ReviewService from '@sort/shared/services/change-requests/review.service'
import * as ConnectionService from '@sort/shared/services/connection.service'
import * as MetadataDatabaseService from '@sort/shared/services/kysely/metadata/database.service'
import * as LabelService from '@sort/shared/services/label.service'
import * as OrganizationService from '@sort/shared/services/org.service'
import * as UserService from '@sort/shared/services/user.service'

import {
  createKysely,
  disconnectKysely,
  getDb
} from '../../../../global/services/kysely.service'
import { getTestServer } from '../../../../global/utils/test.util'
import { createSortJwt } from '../../../utils/jwt.util'
import {
  testInvalidSortAuthHeaders,
  ParamsTester,
  expectNotFound
} from '../../../utils/test.util'

import type * as ConnectionType from '@sort/shared/types/kysely/connection/connection.type'
import type { SortDB } from '@sort/shared/types/kysely.type'
import type { User } from '@sort/shared/types/user.type'

type MetadataDatabase = SortDB['metadata_database']

describe('/v2 change-request reviews routes', () => {
  const userMock = new UserMock()
  const orgMock = new OrganizationMock()
  const dbMock = new MetadataDatabaseMock()
  const labelMock = new LabelMock()
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
  const label1 = labelMock.create({
    connection_id: prvConn.id,
    database_name: prvDbEntry.raw_name
  })
  const label2 = labelMock.create({
    connection_id: prvConn.id,
    database_name: prvDbEntry.raw_name
  })

  let server: Awaited<ReturnType<typeof getTestServer>>

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
    await LabelService.createDatabaseLabel(label1)
    await LabelService.createDatabaseLabel(label2)
  }

  async function cleanupTests() {
    await reviewMock.removeAll()
    await changeRequestMock.removeAll()
    await labelMock.removeAll()
    await connMock.removeAll()
    await dbMock.removeAll()
    await orgMock.removeAll(true)
    await userMock.removeAll()
  }

  beforeAll(async () => {
    server = await getTestServer()
    createKysely()
    await setupTests()
  })

  beforeEach(async () => {
    const mockChangeRequest = changeRequestMock.create({
      created_by: orgAdminUser.id,
      connection_id: prvConn.id,
      database_name: prvDbEntry.raw_name
    })

    await ChangeRequestService.createChangeRequest(mockChangeRequest)
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
    creator: User,
    visibility: 'public' | 'private'
  ) => {
    const connection = visibility === 'public' ? pubConn : prvConn
    const database = visibility === 'public' ? pubDbEntry : prvDbEntry

    const mockChangeRequest = changeRequestMock.create({
      created_by: creator.id,
      connection_id: connection.id,
      database_name: database.raw_name
    })

    return await ChangeRequestService.createChangeRequest(mockChangeRequest)
  }

  const paramsTester = new ParamsTester({
    org_slug: {
      expectedNotFoundEntity: 'organization',
      expectedValidationError: 'must not have more than 99 characters',
      invalidValue: 'x'.repeat(100),
      validValue: org.slug,
      notFoundValue: 'non-existent'
    },
    db_slug: {
      expectedNotFoundEntity: 'database',
      expectedValidationError: 'must not have more than 99 characters',
      invalidValue: 'x'.repeat(100),
      get validValue() {
        return prvDbEntry.slug
      },
      notFoundValue: 'non-existent'
    },
    change_request_number: {
      expectedNotFoundEntity: 'change request',
      expectedValidationError: 'must be a valid number',
      invalidValue: 'invalid-change-request-number',
      validValue: '1',
      notFoundValue: '10'
    },
    review_id: {
      expectedNotFoundEntity: 'review',
      expectedValidationError: 'must be a valid GUID (UUID v4)',
      invalidValue: 'invalid-review-id',
      validValue: randomUUID(),
      notFoundValue: randomUUID()
    }
  })

  const testCreateReview = async (
    caller: User,
    connection: ConnectionType.ConnectionSelectWithEncryption,
    database: MetadataDatabase,
    statusCode: number
  ) => {
    const changeRequest = await createMockChangeRequest(
      caller,
      connection.visibility
    )

    const payload = reviewMock.create({
      change_request_id: changeRequest.id,
      created_by: caller.id,
      event_type: 'COMMENT'
    })

    const response = await server.inject({
      headers: {
        authorization: `Bearer ${createSortJwt(caller.id)}`
      },
      method: 'POST',
      url: `/v2/orgs/${org.slug}/databases/${database.slug}/change-requests/${changeRequest.change_request_number}/reviews`,
      payload
    })

    if (statusCode === 201) {
      expect(response.json()).toEqual({
        type: 'create_review',
        payload: {
          review: expect.objectContaining({
            id: expect.any(String),
            change_request_id: changeRequest.id,
            created_by: caller.id,
            event_type: 'COMMENT',
            text: payload.text,
            created_at: expect.stringMatching(dateFormat),
            updated_at: expect.stringMatching(dateFormat)
          })
        }
      })

      reviewMock.addMockId(response.json().payload.review.id)
    } else if (statusCode === 404) {
      expectNotFound(response, 'database')
    }

    expect(response.statusCode).toBe(statusCode)
  }

  const testGetReviews = async (
    caller: User,
    connection: ConnectionType.ConnectionSelectWithEncryption,
    database: MetadataDatabase,
    statusCode: number
  ) => {
    const changeRequest = await createMockChangeRequest(
      caller,
      connection.visibility
    )

    const createdReview = await reviewMock.createMockReview({
      change_request_id: changeRequest.id,
      created_by: caller.id,
      event_type: 'COMMENT'
    })

    const response = await server.inject({
      headers: {
        authorization: `Bearer ${createSortJwt(caller.id)}`
      },
      method: 'GET',
      url: `/v2/orgs/${org.slug}/databases/${database.slug}/change-requests/${changeRequest.change_request_number}/reviews`
    })

    if (statusCode === 200) {
      expect(response.json()).toEqual({
        type: 'list_reviews',
        payload: {
          reviews: [
            {
              ...createdReview,
              created_at: expect.stringMatching(dateFormat),
              updated_at: expect.stringMatching(dateFormat)
            }
          ]
        }
      })
    } else if (statusCode === 404) {
      expectNotFound(response, 'database')
    }

    expect(response.statusCode).toBe(statusCode)
  }

  const testGetReview = async (
    creator: User,
    caller: User,
    connection: ConnectionType.ConnectionSelectWithEncryption,
    database: MetadataDatabase,
    statusCode: number
  ) => {
    const changeRequest = await createMockChangeRequest(
      caller,
      connection.visibility
    )

    const createdReview = await reviewMock.createMockReview({
      change_request_id: changeRequest.id,
      created_by: creator.id,
      event_type: 'COMMENT'
    })

    const response = await server.inject({
      headers: {
        authorization: `Bearer ${createSortJwt(caller.id)}`
      },
      method: 'GET',
      url: `/v2/orgs/${org.slug}/databases/${database.slug}/change-requests/${changeRequest.change_request_number}/reviews/${createdReview.id}`
    })

    const callerIsCreator = caller.id === createdReview.created_by

    if (statusCode === 200) {
      expect(response.json()).toEqual({
        type: 'get_review',
        payload: {
          review: {
            ...createdReview,
            created_at: expect.stringMatching(dateFormat),
            updated_at: expect.stringMatching(dateFormat),
            permissions: {
              edit_text: {
                message: 'You do not have permission to edit this review',
                value: callerIsCreator
              }
            }
          }
        }
      })
    } else if (statusCode === 404) {
      expectNotFound(response, 'database')
    }

    expect(response.statusCode).toBe(statusCode)
  }

  const testUpdateReview = async (
    creator: User,
    caller: User,
    connection: ConnectionType.ConnectionSelectWithEncryption,
    database: MetadataDatabase,
    statusCode: number
  ) => {
    const changeRequest = await createMockChangeRequest(
      caller,
      connection.visibility
    )

    const createdReview = await reviewMock.createMockReview({
      change_request_id: changeRequest.id,
      created_by: creator.id,
      event_type: 'COMMENT'
    })

    const response = await server.inject({
      headers: {
        authorization: `Bearer ${createSortJwt(caller.id)}`
      },
      method: 'PATCH',
      url: `/v2/orgs/${org.slug}/databases/${database.slug}/change-requests/${changeRequest.change_request_number}/reviews/${createdReview.id}`,
      payload: {
        text: 'Updated change request'
      }
    })

    if (statusCode === 200) {
      expect(response.json()).toEqual({
        type: 'update_review',
        payload: {
          review: {
            ...createdReview,
            event_type: 'COMMENT',
            text: 'Updated change request',
            created_at: expect.stringMatching(dateFormat),
            updated_at: expect.stringMatching(dateFormat)
          }
        }
      })
    } else if (statusCode === 404) {
      expectNotFound(response, 'database')
    }

    expect(response.statusCode).toBe(statusCode)
  }

  describe('create_review operation', () => {
    paramsTester.testInvalidParams({
      method: 'POST',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/reviews',
      userId: orgAdminUser.id
    })

    it('should respond with 400 when no values are passed in the payload', async () => {
      const changeRequest = await createMockChangeRequest(
        orgAdminUser,
        'private'
      )

      const payload = {}

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${changeRequest.change_request_number}/reviews`,
        payload
      })

      expect(response.json()).toEqual({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'A validation error occurred when validating the body.',
            context: 'body',
            errors: {
              body: {
                event_type: 'is required'
              }
            }
          }
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should respond with 400 when event_type is neither COMMENT nor APPROVE', async () => {
      const changeRequest = await createMockChangeRequest(
        orgAdminUser,
        'private'
      )

      const payload = {
        change_request_id: changeRequest.id,
        created_by: orgAdminUser.id,
        event_type: 'INVALID_EVENT_TYPE'
      }

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${changeRequest.change_request_number}/reviews`,
        payload
      })

      expect(response.json()).toEqual({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'A validation error occurred when validating the body.',
            context: 'body',
            errors: {
              body: {
                event_type: 'must match a schema in anyOf'
              }
            }
          }
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should respond with 400 when event_type is null', async () => {
      const changeRequest = await createMockChangeRequest(
        orgAdminUser,
        'private'
      )

      const payload = {
        change_request_id: changeRequest.id,
        created_by: orgAdminUser.id,
        event_type: null
      }

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${changeRequest.change_request_number}/reviews`,
        payload
      })

      expect(response.json()).toEqual({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'A validation error occurred when validating the body.',
            context: 'body',
            errors: {
              body: {
                event_type: 'must match a schema in anyOf'
              }
            }
          }
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should respond with 400 when text is too long', async () => {
      const changeRequest = await createMockChangeRequest(
        orgAdminUser,
        'private'
      )

      const payload = reviewMock.create({
        change_request_id: changeRequest.id,
        created_by: orgAdminUser.id,
        event_type: 'COMMENT',
        text: 'x'.repeat(150001)
      })

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${changeRequest.change_request_number}/reviews`,
        payload
      })

      expect(response.json()).toEqual({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'A validation error occurred when validating the body.',
            context: 'body',
            errors: {
              body: {
                text: 'must not have more than 150000 characters'
              }
            }
          }
        }
      })

      expect(response.statusCode).toBe(400)
    })

    testInvalidSortAuthHeaders({
      method: 'POST',
      url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/123/reviews`
    })

    paramsTester.testNotFound({
      method: 'POST',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/reviews',
      userId: orgAdminUser.id,
      defaultPayload: reviewMock.create()
    })

    it('should respond with 500 when a service error occurs', async () => {
      jest
        .spyOn(ReviewService, 'createReview')
        .mockRejectedValueOnce(new Error('fake error'))

      const changeRequest = await createMockChangeRequest(
        orgAdminUser,
        'private'
      )

      const payload = reviewMock.create({
        change_request_id: changeRequest.id,
        created_by: orgAdminUser.id,
        event_type: 'COMMENT'
      })

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${changeRequest.change_request_number}/reviews`,
        payload
      })

      expect(response.json()).toEqual({
        type: 'error',
        payload: {
          error: {
            message: expect.stringMatching(/If the problem persists/)
          }
        }
      })

      expect(response.statusCode).toBe(500)
    })

    it('should respond with 201 and create a change request review', async () => {
      await testCreateReview(orgAdminUser, pubConn, pubDbEntry, 201)
    })

    describe('for Public Connections', () => {
      describe('when the caller is an Org Owner', () => {
        it('should respond with 201 and successfully create a review', async () => {
          await testCreateReview(orgAdminUser, pubConn, pubDbEntry, 201)
        })
      })

      describe('when the caller is an Org Member', () => {
        it('should respond with 201 and successfully create a review', async () => {
          await testCreateReview(orgMemberUser1, pubConn, pubDbEntry, 201)
        })
      })

      describe('when the caller is a Non-Org Member', () => {
        it('should respond with 403 and not create a review', async () => {
          await testCreateReview(nonOrgUser1, pubConn, pubDbEntry, 403)
        })
      })
    })

    describe('for Private Connections', () => {
      describe('when the caller is an Org Owner', () => {
        it('should respond with 201 and successfully create a review', async () => {
          await testCreateReview(orgAdminUser, prvConn, prvDbEntry, 201)
        })
      })

      describe('when the caller is an Org Member', () => {
        it('should respond with 201 and successfully create a review', async () => {
          await testCreateReview(orgMemberUser1, prvConn, prvDbEntry, 201)
        })
      })

      describe('when the caller is a Non-Org Member', () => {
        it('should respond with 404 and not create a review', async () => {
          await testCreateReview(nonOrgUser1, prvConn, prvDbEntry, 404)
        })
      })
    })
  })

  describe('list_reviews operation', () => {
    paramsTester.testInvalidParams({
      method: 'GET',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/reviews',
      userId: orgAdminUser.id
    })

    testInvalidSortAuthHeaders({
      method: 'GET',
      url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/123/reviews`
    })

    paramsTester.testNotFound({
      method: 'GET',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/reviews',
      userId: orgAdminUser.id
    })

    it('should respond with 500 when a service error occurs', async () => {
      const changeRequest = await createMockChangeRequest(
        orgAdminUser,
        'private'
      )

      jest
        .spyOn(ReviewService, 'getReviews')
        .mockRejectedValueOnce(new Error('fake error'))

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'GET',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${changeRequest.change_request_number}/reviews`
      })

      expect(response.json()).toEqual({
        type: 'error',
        payload: {
          error: {
            message: expect.stringMatching(/If the problem persists/)
          }
        }
      })

      expect(response.statusCode).toBe(500)
    })

    describe('for Public Connections', () => {
      describe('when the caller is an Org Owner', () => {
        it('should respond with 200 and return all reviews', async () => {
          await testGetReviews(orgAdminUser, pubConn, pubDbEntry, 200)
        })
      })

      describe('when the caller is an Org Member', () => {
        it('should respond with 200 and return all reviews', async () => {
          await testGetReviews(orgMemberUser1, pubConn, pubDbEntry, 200)
        })
      })

      describe('when the caller is a Non-Org Member', () => {
        it('should respond with 200 and return all reviews', async () => {
          await testGetReviews(nonOrgUser1, pubConn, pubDbEntry, 200)
        })
      })
    })

    describe('for Private Connections', () => {
      describe('when the caller is an Org Owner', () => {
        it('should respond with 200 and return all reviews', async () => {
          await testGetReviews(orgAdminUser, prvConn, prvDbEntry, 200)
        })
      })

      describe('when the caller is an Org Member', () => {
        it('should respond with 200 and return all reviews', async () => {
          await testGetReviews(orgMemberUser1, prvConn, prvDbEntry, 200)
        })
      })

      describe('when the caller is a Non-Org Member', () => {
        it('should respond with 404 and not return any reviews', async () => {
          await testGetReviews(nonOrgUser1, prvConn, prvDbEntry, 404)
        })
      })
    })
  })

  describe('getReview operation', () => {
    paramsTester.testInvalidParams({
      method: 'GET',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/reviews/:review_id',
      userId: orgAdminUser.id
    })

    testInvalidSortAuthHeaders({
      method: 'GET',
      url: `/v2/orgs/${org.slug}/databases/${
        prvDbEntry.slug
      }/change-requests/123/reviews/${randomUUID()}`
    })

    paramsTester.testNotFound({
      method: 'GET',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/reviews/:review_id',
      userId: orgAdminUser.id
    })

    it('should respond with 500 when a service error occurs', async () => {
      const changeRequest = await createMockChangeRequest(
        orgAdminUser,
        'private'
      )

      jest
        .spyOn(ReviewService, 'getReviews')
        .mockRejectedValueOnce(new Error('fake error'))

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'GET',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${changeRequest.change_request_number}/reviews`
      })

      expect(response.json()).toEqual({
        type: 'error',
        payload: {
          error: {
            message: expect.stringMatching(/If the problem persists/)
          }
        }
      })

      expect(response.statusCode).toBe(500)
    })

    it('should respond with 500 when a service error occurs', async () => {
      const changeRequest = await createMockChangeRequest(
        orgAdminUser,
        'private'
      )

      jest
        .spyOn(ReviewService, 'getReview')
        .mockRejectedValueOnce(new Error('fake error'))

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'GET',
        url: `/v2/orgs/${org.slug}/databases/${
          prvDbEntry.slug
        }/change-requests/${
          changeRequest.change_request_number
        }/reviews/${randomUUID()}`
      })

      expect(response.json()).toEqual({
        type: 'error',
        payload: {
          error: {
            message: expect.stringMatching(/If the problem persists/)
          }
        }
      })

      expect(response.statusCode).toBe(500)
    })

    describe('for Public Connections', () => {
      describe('when the caller is an Org Owner', () => {
        it('should respond with 200 and return the review', async () => {
          await testGetReview(
            orgAdminUser,
            orgAdminUser,
            pubConn,
            pubDbEntry,
            200
          )
        })
      })

      describe('when the caller is an Org Member', () => {
        it('should respond with 200 and return the review', async () => {
          await testGetReview(
            orgMemberUser1,
            orgMemberUser1,
            pubConn,
            pubDbEntry,
            200
          )
        })
      })

      describe('when the caller is a Non-Org Member', () => {
        it('should respond with 200 and return the review', async () => {
          await testGetReview(
            nonOrgUser1,
            nonOrgUser1,
            pubConn,
            pubDbEntry,
            200
          )
        })
      })
    })

    describe('for Private Connections', () => {
      describe('when the caller is an Org Owner', () => {
        it('should respond with 200 and return the review', async () => {
          await testGetReview(
            orgAdminUser,
            orgAdminUser,
            prvConn,
            prvDbEntry,
            200
          )
        })
      })

      describe('when the caller is an Org Member', () => {
        it('should respond with 200 and return the review', async () => {
          await testGetReview(
            orgMemberUser1,
            orgMemberUser1,
            prvConn,
            prvDbEntry,
            200
          )
        })
      })

      describe('when the caller is a Non-Org Member', () => {
        it('should respond with 404 and not return the review', async () => {
          await testGetReview(
            nonOrgUser1,
            nonOrgUser1,
            prvConn,
            prvDbEntry,
            404
          )
        })
      })
    })
  })

  describe('update_review operation', () => {
    paramsTester.testInvalidParams({
      method: 'PATCH',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/reviews/:review_id',
      userId: orgAdminUser.id
    })

    it('should respond with 400 when no values are passed in the payload', async () => {
      const changeRequest = await createMockChangeRequest(
        orgAdminUser,
        'private'
      )

      const payload = {}

      const review = await reviewMock.createMockReview({
        change_request_id: changeRequest.id,
        created_by: orgAdminUser.id,
        event_type: 'COMMENT'
      })

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'PATCH',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${changeRequest.change_request_number}/reviews/${review.id}`,
        payload
      })

      expect(response.json()).toEqual({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'A validation error occurred when validating the body.',
            context: 'body',
            errors: {
              body: {
                text: 'is required'
              }
            }
          }
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should respond with 400 when text is too long', async () => {
      const changeRequest = await createMockChangeRequest(
        orgAdminUser,
        'private'
      )

      const review = await reviewMock.createMockReview({
        change_request_id: changeRequest.id,
        created_by: orgAdminUser.id,
        event_type: 'COMMENT'
      })

      const payload = {
        event_type: 'COMMENT',
        text: 'x'.repeat(150001)
      }

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'PATCH',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${changeRequest.change_request_number}/reviews/${review.id}`,
        payload
      })

      expect(response.json()).toEqual({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'A validation error occurred when validating the body.',
            context: 'body',
            errors: {
              body: {
                text: 'must not have more than 150000 characters'
              }
            }
          }
        }
      })

      expect(response.statusCode).toBe(400)
    })

    testInvalidSortAuthHeaders({
      method: 'PATCH',
      url: `/v2/orgs/${org.slug}/databases/${
        prvDbEntry.slug
      }/change-requests/123/reviews/${randomUUID()}`
    })

    paramsTester.testNotFound({
      method: 'PATCH',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/reviews/:review_id',
      userId: orgAdminUser.id,
      defaultPayload: reviewMock.create()
    })

    it('should respond with 500 when a service error occurs', async () => {
      const changeRequest = await createMockChangeRequest(
        orgAdminUser,
        'private'
      )

      const review = await reviewMock.createMockReview({
        change_request_id: changeRequest.id,
        created_by: orgAdminUser.id,
        event_type: 'COMMENT'
      })

      jest
        .spyOn(ReviewService, 'updateReview')
        .mockRejectedValueOnce(new Error('fake error'))

      const payload = {
        event_type: 'COMMENT',
        text: 'Updated change request'
      }

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'PATCH',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/change-requests/${changeRequest.change_request_number}/reviews/${review.id}`,
        payload
      })

      expect(response.json()).toEqual({
        type: 'error',
        payload: {
          error: {
            message: expect.stringMatching(/If the problem persists/)
          }
        }
      })

      expect(response.statusCode).toBe(500)
    })

    describe('for Public Connections', () => {
      describe('when the caller is an Org Owner', () => {
        describe('who is the review author', () => {
          it('should respond with 200 and update the review', async () => {
            await testUpdateReview(
              orgAdminUser,
              orgAdminUser,
              pubConn,
              pubDbEntry,
              200
            )
          })
        })

        describe('who is not the review author', () => {
          it('should respond with 403 and not update the review', async () => {
            await testUpdateReview(
              orgMemberUser1,
              orgAdminUser,
              pubConn,
              pubDbEntry,
              403
            )
          })
        })
      })

      describe('when the caller is an Org Member', () => {
        describe('who is the review author', () => {
          it('should respond with 200 and update the review', async () => {
            await testUpdateReview(
              orgMemberUser1,
              orgMemberUser1,
              pubConn,
              pubDbEntry,
              200
            )
          })
        })

        describe('who is not the review author', () => {
          it('should respond with 403 and not update the review', async () => {
            await testUpdateReview(
              orgMemberUser1,
              orgMemberUser2,
              pubConn,
              pubDbEntry,
              403
            )
          })
        })
      })

      describe('when the caller is a Non-Org Member', () => {
        it('should respond with 403 and not update the review', async () => {
          await testUpdateReview(
            orgMemberUser1,
            nonOrgUser1,
            pubConn,
            pubDbEntry,
            403
          )
        })
      })
    })

    describe('for Private Connections', () => {
      describe('when the caller is an Org Owner', () => {
        describe('who is the review author', () => {
          it('should respond with 200 and update the review', async () => {
            await testUpdateReview(
              orgAdminUser,
              orgAdminUser,
              prvConn,
              prvDbEntry,
              200
            )
          })
        })

        describe('who is not the review author', () => {
          it('should respond with 403 and not update the review', async () => {
            await testUpdateReview(
              orgMemberUser1,
              orgAdminUser,
              prvConn,
              prvDbEntry,
              403
            )
          })
        })
      })

      describe('when the caller is an Org Member', () => {
        describe('who is the review author', () => {
          it('should respond with 200 and update the review', async () => {
            await testUpdateReview(
              orgMemberUser1,
              orgMemberUser1,
              prvConn,
              prvDbEntry,
              200
            )
          })
        })

        describe('who is not the review author', () => {
          it('should respond with 403 and not update the review', async () => {
            await testUpdateReview(
              orgMemberUser1,
              orgMemberUser2,
              prvConn,
              prvDbEntry,
              403
            )
          })
        })
      })

      describe('when the caller is a Non-Org Member', () => {
        it('should respond with 404 and not update the review', async () => {
          await testUpdateReview(
            orgMemberUser1,
            nonOrgUser1,
            prvConn,
            prvDbEntry,
            404
          )
        })
      })
    })
  })
})
