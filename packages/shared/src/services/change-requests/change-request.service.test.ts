import { randomUUID } from 'node:crypto'

import {
  createKysely,
  disconnectKysely,
  getDb,
  getConfig,
  logger
} from '../../'
import { JobExistsError } from '../../errors/job-exists.error'
import { NotApprovedError } from '../../errors/not-approved.error'
import { NotFoundError } from '../../errors/not-found.error'
import { ChangeRequestCommentMock } from '../../mocks/change-requests/change-request-comment.mock'
import { ChangeRequestMock } from '../../mocks/change-requests/change-request.mock'
import { ChangeMock } from '../../mocks/change-requests/change.mock'
import { ConnectionMock } from '../../mocks/connection.mock'
import { LabelMock } from '../../mocks/label.mock'
import {
  MetadataDatabaseMock,
  MetadataTableMock
} from '../../mocks/metadata.mock'
import { OrganizationMock } from '../../mocks/org.mock'
import { ReviewMock } from '../../mocks/review.mock'
import { UserMock } from '../../mocks/user.mock'
import * as ChangeService from '../changes/change.service'
import * as ConnectionService from '../connection.service'
import * as MetadataDatabaseService from '../kysely/metadata/database.service'
import * as MetadataTableService from '../kysely/metadata/table.service'
import * as LabelService from '../label.service'
import * as OrganizationService from '../org.service'
import * as UserService from '../user.service'

import * as ChangeRequestService from './change-request.service'

import type { OrganizationMember } from '../../schemas/org-member.schema'

describe('change-request.service', () => {
  const userMock = new UserMock()
  const orgMock = new OrganizationMock()
  const dbMock = new MetadataDatabaseMock()
  const labelMock = new LabelMock()
  const connMock = new ConnectionMock()
  const changeRequestMock = new ChangeRequestMock()
  const changeRequestCommentMock = new ChangeRequestCommentMock()
  const reviewMock = new ReviewMock()
  const tableMock = new MetadataTableMock()
  const changeMock = new ChangeMock()

  const user = userMock.create()
  const user2 = userMock.create()
  const user3 = userMock.create()
  const org = orgMock.create({ created_by: user.id })
  const conn = connMock.create({
    organization_id: org.id,
    created_by: user.id
  })
  const dbEntry = dbMock.create({
    organization_id: org.id,
    connection_id: conn.id
  })
  const label1 = labelMock.create({
    connection_id: conn.id,
    database_name: dbEntry.raw_name
  })
  const label2 = labelMock.create({
    connection_id: conn.id,
    database_name: dbEntry.raw_name
  })
  const label3 = labelMock.create({
    connection_id: conn.id,
    database_name: dbEntry.raw_name
  })

  // TODO: Create an OrganizationMemberMock
  const orgOwner = {
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      picture: user.picture
    },
    role: {
      id: 0,
      name: 'owner'
    }
  } satisfies OrganizationMember

  beforeAll(async () => {
    createKysely({ config: getConfig(), sortLogger: logger })

    await UserService.createUser(user)
    await UserService.createUser(user2)
    await UserService.createUser(user3)
    await OrganizationService.create(org)
    await OrganizationService.addMember(org.slug, user2.id, 'member')
    await OrganizationService.addMember(org.slug, user3.id, 'member')
    await ConnectionService.create(conn)
    await MetadataDatabaseService.insertMetadataDb(getDb(), dbEntry)
    await LabelService.createDatabaseLabel(label1)
    await LabelService.createDatabaseLabel(label2)
    await LabelService.createDatabaseLabel(label3)
  })

  afterEach(async () => {
    await changeRequestCommentMock.removeAll()
    await changeMock.removeAll()
    await tableMock.removeAll()
    await reviewMock.removeAll()
    await changeRequestMock.removeAll()
  })

  afterAll(async () => {
    await changeRequestCommentMock.removeAll()
    await changeMock.removeAll()
    await tableMock.removeAll()
    await reviewMock.removeAll()
    await changeRequestMock.removeAll()
    await labelMock.removeAll()
    await connMock.removeAll()
    await dbMock.removeAll()
    await orgMock.removeAll(true)
    await userMock.removeAll()

    await disconnectKysely()
  })

  describe('createChangeRequest', () => {
    it('should create a change request with all fields', async () => {
      const mockChangeRequest = changeRequestMock.create({
        id: randomUUID(),
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Detailed Test Change Request',
        description: 'This change request has all possible fields defined.',
        labels: [label1, label2],
        reviewers: [orgOwner]
      })

      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      expect(createdChangeRequest).toBeDefined()
      expect(createdChangeRequest.id).toBeDefined()
      expect(createdChangeRequest.connection_id).toBe(
        mockChangeRequest.connection_id
      )
      expect(createdChangeRequest.database_name).toBe(
        mockChangeRequest.database_name
      )
      expect(createdChangeRequest.created_by).toBe(mockChangeRequest.created_by)
      expect(createdChangeRequest.change_request_number).toBe(1)
      expect(createdChangeRequest.title).toBe(mockChangeRequest.title)
      expect(createdChangeRequest.description).toBe(
        mockChangeRequest.description
      )
      expect(createdChangeRequest.status).toBe('open')
      expect(createdChangeRequest.created_at).toBeDefined()
      expect(createdChangeRequest.updated_at).toBeDefined()
      expect(createdChangeRequest.labels.length).toBe(2)
      expect(createdChangeRequest.reviewers.length).toBe(1)
    })

    it('should create a change request with minimal fields', async () => {
      const mockChangeRequest = changeRequestMock.create({
        id: randomUUID(),
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Minimal Test Change Request'
      })

      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      expect(createdChangeRequest).toBeDefined()
      expect(createdChangeRequest.id).toBeDefined()
      expect(createdChangeRequest.connection_id).toBe(
        mockChangeRequest.connection_id
      )
      expect(createdChangeRequest.database_name).toBe(
        mockChangeRequest.database_name
      )
      expect(createdChangeRequest.created_by).toBe(mockChangeRequest.created_by)
      expect(createdChangeRequest.change_request_number).toBe(1)
      expect(createdChangeRequest.title).toBe(mockChangeRequest.title)
      expect(createdChangeRequest.description).toBeNull()
      expect(createdChangeRequest.status).toBe('open')
      expect(createdChangeRequest.created_at).toBeDefined()
      expect(createdChangeRequest.updated_at).toBeDefined()
      expect(createdChangeRequest.labels.length).toBe(0)
      expect(createdChangeRequest.reviewers.length).toBe(0)
    })

    it('should auto-increment change_request_number starting from 1 within a specific (connection_id, raw_name)', async () => {
      const firstMockChangeRequest = changeRequestMock.create({
        id: randomUUID(),
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'First Change Request'
      })

      const secondMockChangeRequest = changeRequestMock.create({
        id: randomUUID(),
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Second Change Request'
      })

      const firstChangeRequest = await ChangeRequestService.createChangeRequest(
        firstMockChangeRequest
      )
      const secondChangeRequest =
        await ChangeRequestService.createChangeRequest(secondMockChangeRequest)

      expect(firstChangeRequest.change_request_number).toBe(1)
      expect(secondChangeRequest.change_request_number).toBe(2)
    })

    it('should auto-increment change request number starting from 1 for different (connection_id, raw_name)', async () => {
      const conn2 = connMock.create({
        organization_id: org.id,
        created_by: user.id
      })
      const dbEntry2 = dbMock.create({
        organization_id: org.id,
        connection_id: conn2.id
      })

      await ConnectionService.create(conn2)
      await MetadataDatabaseService.insertMetadataDb(getDb(), dbEntry2)

      const firstMockChangeRequest = changeRequestMock.create({
        id: randomUUID(),
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'First DB, First Change Request'
      })

      const secondMockChangeRequest = changeRequestMock.create({
        id: randomUUID(),
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'First DB, Second Change Request'
      })

      const thirdMockChangeRequest = changeRequestMock.create({
        id: randomUUID(),
        connection_id: dbEntry2.connection_id,
        database_name: dbEntry2.raw_name,
        created_by: user.id,
        title: 'Second DB, First Change Request'
      })

      const firstChangeRequest = await ChangeRequestService.createChangeRequest(
        firstMockChangeRequest
      )
      const secondChangeRequest =
        await ChangeRequestService.createChangeRequest(secondMockChangeRequest)
      const thirdChangeRequest = await ChangeRequestService.createChangeRequest(
        thirdMockChangeRequest
      )

      expect(firstChangeRequest.change_request_number).toBe(1)
      expect(secondChangeRequest.change_request_number).toBe(2)
      expect(thirdChangeRequest.change_request_number).toBe(1)
    })

    it('should default changeRequest.status to "open"', async () => {
      const mockChangeRequest = changeRequestMock.create({
        id: randomUUID(),
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'New Change Request'
      })

      const changeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      expect(changeRequest.status).toBe('open')
    })

    it('should emit CREATE_CHANGE_REQUEST events on change request creation', async () => {
      const mockChangeRequest = changeRequestMock.create({
        id: randomUUID(),
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'New Change Request'
      })

      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      const events = await getDb()
        .selectFrom('change_request_history')
        .selectAll()
        .where('change_request_id', '=', mockChangeRequest.id)
        .execute()

      expect(events).toHaveLength(1)
      expect(events[0]).toEqual({
        id: expect.any(String),
        change_request_id: createdChangeRequest.id,
        user_id: createdChangeRequest.created_by,
        action_type: 'CREATE_CHANGE_REQUEST',
        action_details: { change_request_number: 1 },
        created_at: expect.any(Date)
      })
    })

    it('should reject non-existent metadata database', async () => {
      const nonExistentConnectionId = randomUUID()

      const mockChangeRequest = changeRequestMock.create({
        id: randomUUID(),
        connection_id: nonExistentConnectionId,
        database_name: 'non-existent-db-name',
        created_by: user.id,
        title: 'Change Request with non-existent Metadata Database'
      })

      try {
        await ChangeRequestService.createChangeRequest(mockChangeRequest)
        fail(
          'Expected change request creation to fail with non-existent connection'
        )
      } catch (error) {
        if (!(error instanceof Error)) {
          fail('Caught error is not of type Error')
        }

        if (!(error.cause && error.cause instanceof Error)) {
          fail('Caught error cause is not of type Error')
        }

        expect(error.message).toBe('Failed to create change request')
        expect(error.cause.message).toContain(
          'violates foreign key constraint "fk_change_request_metadata_database"'
        )
      }
    })

    it('should reject non-existent user in created_by', async () => {
      const nonExistentUserId = randomUUID()

      const mockChangeRequest = changeRequestMock.create({
        id: randomUUID(),
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: nonExistentUserId,
        title: 'Change Request with non-existent created_by User'
      })

      try {
        await ChangeRequestService.createChangeRequest(mockChangeRequest)
        fail('Expected change request creation to fail with non-existent user')
      } catch (error) {
        if (!(error instanceof Error)) {
          fail('Caught error is not of type Error')
        }

        if (!(error.cause && error.cause instanceof Error)) {
          fail('Caught error cause is not of type Error')
        }

        expect(error.message).toBe('Failed to create change request')
        expect(error.cause.message).toContain(
          'violates foreign key constraint "fk_change_request_created_by"'
        )
      }
    })

    it('should reject titles exceeding 256 character length', async () => {
      const longTitle = 'a'.repeat(257)

      const mockChangeRequest = changeRequestMock.create({
        id: randomUUID(),
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: longTitle
      })

      try {
        await ChangeRequestService.createChangeRequest(mockChangeRequest)
        fail('Expected change request creation to fail with long title')
      } catch (error) {
        if (!(error instanceof Error)) {
          fail('Caught error is not of type Error')
        }

        if (!(error.cause && error.cause instanceof Error)) {
          fail('Caught error cause is not of type Error')
        }

        expect(error.message).toBe('Failed to create change request')
        expect(error.cause.message).toContain(
          'value too long for type character varying(256)'
        )
      }
    })

    it('should reject duplicate labels', async () => {
      const mockChangeRequest = changeRequestMock.create({
        id: randomUUID(),
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Change Request with duplicate labels',
        labels: [label1, label1]
      })

      try {
        await ChangeRequestService.createChangeRequest(mockChangeRequest)
        fail('Expected change request creation to fail with duplicate labels')
      } catch (error) {
        if (!(error instanceof Error)) {
          fail('Caught error is not of type Error')
        }

        if (!(error.cause && error.cause instanceof Error)) {
          fail('Caught error cause is not of type Error')
        }

        expect(error.message).toBe('Failed to create change request')
        expect(error.cause.message).toContain(
          'duplicate key value violates unique constraint "change_request_label_pkey"'
        )
      }
    })

    it('should reject duplicate reviewers', async () => {
      const mockChangeRequest = changeRequestMock.create({
        id: randomUUID(),
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Change Request with duplicate reviewers',
        reviewers: [orgOwner, orgOwner]
      })

      try {
        await ChangeRequestService.createChangeRequest(mockChangeRequest)
        fail(
          'Expected change request creation to fail with duplicate reviewers'
        )
      } catch (error) {
        if (!(error instanceof Error)) {
          fail('Caught error is not of type Error')
        }

        if (!(error.cause && error.cause instanceof Error)) {
          fail('Caught error cause is not of type Error')
        }

        expect(error.message).toBe('Failed to create change request')
        expect(error.cause.message).toContain(
          'duplicate key value violates unique constraint "change_request_reviewer_pkey"'
        )
      }
    })
  })

  describe('getChangeRequest', () => {
    it('should return null if no change requests are found w/ the criteria', async () => {
      const changeRequest =
        await ChangeRequestService.getFullChangeRequestResponse({
          org_slug: org.slug,
          connection_id: dbEntry.connection_id,
          database_name: dbEntry.raw_name,
          change_request_number: 100
        })

      expect(changeRequest).toBeNull()
    })
  })

  describe('getDatabaseChangeRequests', () => {
    it('should return an empty array if no change requests are found', async () => {
      const changeRequests =
        await ChangeRequestService.getFullChangeRequestsResponse({
          org_slug: org.slug,
          connection_id: dbEntry.connection_id,
          database_name: dbEntry.raw_name
        })

      expect(changeRequests).toBeDefined()
      expect(changeRequests).toHaveLength(0)
    })

    it('should return change requests with labels and reviewers', async () => {
      const mockChangeRequest = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Change Request',
        labels: [label1, label2],
        reviewers: [orgOwner]
      })

      await ChangeRequestService.createChangeRequest(mockChangeRequest)

      const changeRequests =
        await ChangeRequestService.getFullChangeRequestsResponse({
          org_slug: org.slug,
          connection_id: dbEntry.connection_id,
          database_name: dbEntry.raw_name
        })

      expect(changeRequests).toBeDefined()
      expect(changeRequests).toHaveLength(1)
      expect(changeRequests[0].labels).toHaveLength(2)
      expect(changeRequests[0].reviewers).toHaveLength(1)
    })

    it('should handle change requests with no labels or reviewers', async () => {
      const mockChangeRequest = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Change Request'
      })

      await ChangeRequestService.createChangeRequest(mockChangeRequest)

      const changeRequests =
        await ChangeRequestService.getFullChangeRequestsResponse({
          org_slug: org.slug,
          connection_id: dbEntry.connection_id,
          database_name: dbEntry.raw_name
        })

      expect(changeRequests).toBeDefined()
      expect(changeRequests).toHaveLength(1)
      expect(changeRequests[0].labels).toHaveLength(0)
      expect(changeRequests[0].reviewers).toHaveLength(0)
    })

    it('should return only the first 100 change requests', async () => {
      for (let i = 0; 102 > i; i++) {
        const mockChangeRequest = changeRequestMock.create({
          connection_id: dbEntry.connection_id,
          database_name: dbEntry.raw_name,
          created_by: user.id,
          title: `Test Change Request ${Math.random()}`
        })

        await ChangeRequestService.createChangeRequest(mockChangeRequest)
      }

      const changeRequests =
        await ChangeRequestService.getFullChangeRequestsResponse({
          org_slug: org.slug,
          connection_id: dbEntry.connection_id,
          database_name: dbEntry.raw_name
        })

      expect(changeRequests).toBeDefined()
      expect(changeRequests).toHaveLength(100)
    })
  })

  describe('createChangeRequestComment', () => {
    describe('for top-level change request comments', () => {
      it('should create a comment when change_id and review_id are undefined', async () => {
        const mockChangeRequest = changeRequestMock.create({
          connection_id: dbEntry.connection_id,
          database_name: dbEntry.raw_name,
          created_by: user.id,
          title: 'Test Change Request'
        })

        const createdChangeRequest =
          await ChangeRequestService.createChangeRequest(mockChangeRequest)

        const mockComment = changeRequestCommentMock.create({
          change_request_id: createdChangeRequest.id,
          created_by: user.id
        })

        const createdComment =
          await ChangeRequestService.createChangeRequestComment(
            {
              org_slug: org.slug,
              change_request_id: createdChangeRequest.id
            },
            mockComment
          )

        expect(createdComment).toEqual({
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          change_id: null,
          review_id: null,
          created_by: user.id,
          content: mockComment.content,
          created_at: expect.any(Date),
          updated_at: expect.any(Date)
        })
      })

      it('should create a comment when change_id and review_id are null', async () => {
        const mockChangeRequest = changeRequestMock.create({
          connection_id: dbEntry.connection_id,
          database_name: dbEntry.raw_name,
          created_by: user.id,
          title: 'Test Change Request'
        })

        const createdChangeRequest =
          await ChangeRequestService.createChangeRequest(mockChangeRequest)

        const mockComment = changeRequestCommentMock.create({
          change_request_id: createdChangeRequest.id,
          change_id: null,
          review_id: null,
          created_by: user.id
        })

        const createdComment =
          await ChangeRequestService.createChangeRequestComment(
            {
              org_slug: org.slug,
              change_request_id: createdChangeRequest.id
            },
            mockComment
          )

        expect(createdComment).toEqual({
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          change_id: null,
          review_id: null,
          created_by: user.id,
          content: mockComment.content,
          created_at: expect.any(Date),
          updated_at: expect.any(Date)
        })
      })

      it('should emit ADD_COMMENT events on comment creation', async () => {
        const mockChangeRequest = changeRequestMock.create({
          connection_id: dbEntry.connection_id,
          database_name: dbEntry.raw_name,
          created_by: user.id,
          title: 'Test Change Request'
        })

        const createdChangeRequest =
          await ChangeRequestService.createChangeRequest(mockChangeRequest)

        const mockComment = changeRequestCommentMock.create({
          change_request_id: createdChangeRequest.id,
          created_by: user.id
        })

        const createdComment =
          await ChangeRequestService.createChangeRequestComment(
            {
              org_slug: org.slug,
              change_request_id: createdChangeRequest.id
            },
            mockComment
          )

        const events = await getDb()
          .selectFrom('change_request_history')
          .selectAll()
          .where('change_request_id', '=', createdChangeRequest.id)
          .execute()

        expect(events).toHaveLength(2)
        expect(events[1]).toMatchObject({
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user_id: user.id,
          action_type: 'ADD_COMMENT',
          action_details: {
            comment_id: createdComment.id,
            change_id: null,
            review_id: null,
            content: mockComment.content
          },
          created_at: expect.any(Date)
        })
      })
    })

    describe('for change-specific comments', () => {
      it('should create a comment when change_id is defined and review_id is undefined', async () => {
        const mockChangeRequest = changeRequestMock.create({
          connection_id: dbEntry.connection_id,
          database_name: dbEntry.raw_name,
          created_by: user.id,
          title: 'Test Change Request'
        })

        const createdChangeRequest =
          await ChangeRequestService.createChangeRequest(mockChangeRequest)

        const mockTable = tableMock.create({
          connection_id: conn.id,
          raw_database_name: dbEntry.raw_name,
          raw_name: 'test_table',
          raw_schema_name: 'public'
        })

        const createdTable = await MetadataTableService.insertTable(mockTable)

        const mockChange = changeMock.create({
          change_request_id: createdChangeRequest.id,
          connection_id: conn.id,
          metadata_database_name: dbEntry.raw_name,
          metadata_table_name: createdTable.raw_name,
          metadata_schema_name: createdTable.raw_schema_name
        })

        const createdChange = await ChangeService.insertChange(
          getDb(),
          mockChange
        )

        const mockComment = changeRequestCommentMock.create({
          change_request_id: createdChangeRequest.id,
          change_id: createdChange.id,
          created_by: user.id
        })

        const createdComment =
          await ChangeRequestService.createChangeRequestComment(
            {
              org_slug: org.slug,
              change_request_id: createdChangeRequest.id,
              change_id: createdChange.id
            },
            mockComment
          )

        expect(createdComment).toEqual({
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          change_id: createdChange.id,
          review_id: null,
          created_by: user.id,
          content: mockComment.content,
          created_at: expect.any(Date),
          updated_at: expect.any(Date)
        })
      })

      it('should create a comment when change_id is defined and review_id is null', async () => {
        const mockChangeRequest = changeRequestMock.create({
          connection_id: dbEntry.connection_id,
          database_name: dbEntry.raw_name,
          created_by: user.id,
          title: 'Test Change Request'
        })

        const createdChangeRequest =
          await ChangeRequestService.createChangeRequest(mockChangeRequest)

        const mockTable = tableMock.create({
          connection_id: conn.id,
          raw_database_name: dbEntry.raw_name,
          raw_name: 'test_table',
          raw_schema_name: 'public'
        })

        const createdTable = await MetadataTableService.insertTable(mockTable)

        const mockChange = changeMock.create({
          change_request_id: createdChangeRequest.id,
          connection_id: conn.id,
          metadata_database_name: dbEntry.raw_name,
          metadata_table_name: createdTable.raw_name,
          metadata_schema_name: createdTable.raw_schema_name
        })

        const createdChange = await ChangeService.insertChange(
          getDb(),
          mockChange
        )

        const mockComment = changeRequestCommentMock.create({
          change_request_id: createdChangeRequest.id,
          change_id: createdChange.id,
          review_id: null,
          created_by: user.id
        })

        const createdComment =
          await ChangeRequestService.createChangeRequestComment(
            {
              org_slug: org.slug,
              change_request_id: createdChangeRequest.id,
              change_id: createdChange.id
            },
            mockComment
          )

        expect(createdComment).toEqual({
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          change_id: createdChange.id,
          review_id: null,
          created_by: user.id,
          content: mockComment.content,
          created_at: expect.any(Date),
          updated_at: expect.any(Date)
        })
      })

      it('should emit ADD_COMMENT events on comment creation', async () => {
        const mockChangeRequest = changeRequestMock.create({
          connection_id: dbEntry.connection_id,
          database_name: dbEntry.raw_name,
          created_by: user.id,
          title: 'Test Change Request'
        })

        const createdChangeRequest =
          await ChangeRequestService.createChangeRequest(mockChangeRequest)

        const mockTable = tableMock.create({
          connection_id: conn.id,
          raw_database_name: dbEntry.raw_name,
          raw_name: 'test_table',
          raw_schema_name: 'public'
        })

        const createdTable = await MetadataTableService.insertTable(mockTable)

        const mockChange = changeMock.create({
          change_request_id: createdChangeRequest.id,
          connection_id: conn.id,
          metadata_database_name: dbEntry.raw_name,
          metadata_table_name: createdTable.raw_name,
          metadata_schema_name: createdTable.raw_schema_name
        })

        const createdChange = await ChangeService.insertChange(
          getDb(),
          mockChange
        )

        const mockComment = changeRequestCommentMock.create({
          change_request_id: createdChangeRequest.id,
          change_id: createdChange.id,
          created_by: user.id
        })

        const createdComment =
          await ChangeRequestService.createChangeRequestComment(
            {
              org_slug: org.slug,
              change_request_id: createdChangeRequest.id,
              change_id: createdChange.id
            },
            mockComment
          )

        const events = await getDb()
          .selectFrom('change_request_history')
          .selectAll()
          .where('change_request_id', '=', createdChangeRequest.id)
          .execute()

        expect(events).toHaveLength(2)
        expect(events[1]).toMatchObject({
          change_request_id: createdChangeRequest.id,
          user_id: user.id,
          action_type: 'ADD_COMMENT',
          action_details: {
            comment_id: createdComment.id,
            change_id: createdChange.id,
            review_id: null,
            content: mockComment.content
          }
        })
      })

      it('should reject non-existent change', async () => {
        const mockChangeRequest = changeRequestMock.create({
          connection_id: dbEntry.connection_id,
          database_name: dbEntry.raw_name,
          created_by: user.id,
          title: 'Test Change Request'
        })

        const createdChangeRequest =
          await ChangeRequestService.createChangeRequest(mockChangeRequest)

        const nonExistentChangeId = randomUUID()

        const mockComment = changeRequestCommentMock.create({
          change_request_id: createdChangeRequest.id,
          change_id: nonExistentChangeId,
          created_by: user.id
        })

        try {
          await ChangeRequestService.createChangeRequestComment(
            {
              org_slug: org.slug,
              change_request_id: createdChangeRequest.id,
              change_id: nonExistentChangeId
            },
            mockComment
          )
          fail(
            'Expected change request comment creation to fail with non-existent change'
          )
        } catch (error) {
          if (!(error instanceof Error)) {
            fail('Caught error is not of type Error')
          }

          if (!(error.cause && error.cause instanceof Error)) {
            fail('Caught error cause is not of type Error')
          }

          expect(error.message).toBe('Change does not exist')
          expect(error.cause.message).toContain(
            'violates foreign key constraint "fk_change_request_comment_change_id"'
          )
        }
      })
    })

    it('should reject non-existent change request', async () => {
      const nonExistentChangeRequestId = randomUUID()

      try {
        await ChangeRequestService.createChangeRequestComment(
          {
            org_slug: org.slug,
            change_request_id: nonExistentChangeRequestId
          },
          {
            id: randomUUID(),
            created_by: user.id,
            content: 'This is a test comment for a non-existent change request.'
          }
        )
        fail(
          'Expected change request comment creation to fail with non-existent change request'
        )
      } catch (error) {
        if (!(error instanceof Error)) {
          fail('Caught error is not of type Error')
        }

        if (!(error.cause && error.cause instanceof Error)) {
          fail('Caught error cause is not of type Error')
        }

        expect(error.message).toBe('Change Request does not exist')
        expect(error.cause.message).toContain(
          'violates foreign key constraint "fk_change_request_comment_change_request_id"'
        )
      }
    })
  })

  describe('getChangeRequestComments', () => {
    it('should return an empty array if no change request comments are found', async () => {
      const comments = await ChangeRequestService.getChangeRequestComments({
        change_request_id: randomUUID(),
        change_id: randomUUID(),
        review_id: randomUUID()
      })

      expect(comments).toBeDefined()
      expect(comments).toBeInstanceOf(Array)
      expect(comments).toHaveLength(0)
    })

    it('should return all comments for a given change request when given only a change_request_id', async () => {
      const mockChangeRequest = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Change Request'
      })

      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      const mockComment1 = changeRequestCommentMock.create({
        change_request_id: createdChangeRequest.id,
        created_by: user.id
      })

      const mockComment2 = changeRequestCommentMock.create({
        change_request_id: createdChangeRequest.id,
        created_by: user.id
      })

      await ChangeRequestService.createChangeRequestComment(
        {
          org_slug: org.slug,
          change_request_id: createdChangeRequest.id
        },
        mockComment1
      )

      await ChangeRequestService.createChangeRequestComment(
        {
          org_slug: org.slug,
          change_request_id: createdChangeRequest.id
        },
        mockComment2
      )

      const comments = await ChangeRequestService.getChangeRequestComments({
        change_request_id: createdChangeRequest.id
      })

      expect(comments).toEqual([
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          change_id: null,
          review_id: null,
          created_by: user.id,
          content: mockComment1.content,
          created_at: expect.any(Date),
          updated_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          change_id: null,
          review_id: null,
          created_by: user.id,
          content: mockComment2.content,
          created_at: expect.any(Date),
          updated_at: expect.any(Date)
        }
      ])
    })

    it('should return all comments for a given change when only a change_id is provided', async () => {
      const mockChangeRequest = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Change Request'
      })

      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      const mockTable = tableMock.create({
        connection_id: conn.id,
        raw_database_name: dbEntry.raw_name,
        raw_name: 'test_table',
        raw_schema_name: 'public'
      })

      const createdTable = await MetadataTableService.insertTable(mockTable)

      const mockChange = changeMock.create({
        change_request_id: createdChangeRequest.id,
        connection_id: conn.id,
        metadata_database_name: dbEntry.raw_name,
        metadata_table_name: createdTable.raw_name,
        metadata_schema_name: createdTable.raw_schema_name
      })

      const createdChange = await ChangeService.insertChange(
        getDb(),
        mockChange
      )

      const mockComment1 = changeRequestCommentMock.create({
        change_request_id: createdChangeRequest.id,
        change_id: createdChange.id,
        created_by: user.id
      })

      const mockComment2 = changeRequestCommentMock.create({
        change_request_id: createdChangeRequest.id,
        change_id: createdChange.id,
        created_by: user.id
      })

      await ChangeRequestService.createChangeRequestComment(
        {
          org_slug: org.slug,
          change_request_id: createdChangeRequest.id,
          change_id: createdChange.id
        },
        mockComment1
      )

      await ChangeRequestService.createChangeRequestComment(
        {
          org_slug: org.slug,
          change_request_id: createdChangeRequest.id,
          change_id: createdChange.id
        },
        mockComment2
      )

      const comments = await ChangeRequestService.getChangeRequestComments({
        change_id: createdChange.id
      })

      expect(comments).toEqual([
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          change_id: createdChange.id,
          review_id: null,
          created_by: user.id,
          content: mockComment1.content,
          created_at: expect.any(Date),
          updated_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          change_id: createdChange.id,
          review_id: null,
          created_by: user.id,
          content: mockComment2.content,
          created_at: expect.any(Date),
          updated_at: expect.any(Date)
        }
      ])
    })

    it('should return all comments for a given change when both change_request_id and change_id are provided', async () => {
      const mockChangeRequest = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Change Request'
      })

      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      const mockTable = tableMock.create({
        connection_id: conn.id,
        raw_database_name: dbEntry.raw_name,
        raw_name: 'test_table',
        raw_schema_name: 'public'
      })

      const createdTable = await MetadataTableService.insertTable(mockTable)

      const mockChange = changeMock.create({
        change_request_id: createdChangeRequest.id,
        connection_id: conn.id,
        metadata_database_name: dbEntry.raw_name,
        metadata_table_name: createdTable.raw_name,
        metadata_schema_name: createdTable.raw_schema_name
      })

      const createdChange = await ChangeService.insertChange(
        getDb(),
        mockChange
      )

      const mockComment1 = changeRequestCommentMock.create({
        change_request_id: createdChangeRequest.id,
        change_id: createdChange.id,
        created_by: user.id
      })

      const mockComment2 = changeRequestCommentMock.create({
        change_request_id: createdChangeRequest.id,
        change_id: createdChange.id,
        created_by: user.id
      })

      await ChangeRequestService.createChangeRequestComment(
        {
          org_slug: org.slug,
          change_request_id: createdChangeRequest.id,
          change_id: createdChange.id
        },
        mockComment1
      )

      await ChangeRequestService.createChangeRequestComment(
        {
          org_slug: org.slug,
          change_request_id: createdChangeRequest.id,
          change_id: createdChange.id
        },
        mockComment2
      )

      const comments = await ChangeRequestService.getChangeRequestComments({
        change_request_id: createdChangeRequest.id,
        change_id: createdChange.id
      })

      expect(comments).toEqual([
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          change_id: createdChange.id,
          review_id: null,
          created_by: user.id,
          content: mockComment1.content,
          created_at: expect.any(Date),
          updated_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          change_id: createdChange.id,
          review_id: null,
          created_by: user.id,
          content: mockComment2.content,
          created_at: expect.any(Date),
          updated_at: expect.any(Date)
        }
      ])
    })

    it('should return all comments for a given review when only a review_id is provided', async () => {
      const mockChangeRequest = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Change Request'
      })

      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      const createdReview = await reviewMock.createMockReview({
        change_request_id: createdChangeRequest.id,
        created_by: user.id
      })

      const mockComment1 = changeRequestCommentMock.create({
        change_request_id: createdChangeRequest.id,
        review_id: createdReview.id,
        created_by: user.id
      })

      const mockComment2 = changeRequestCommentMock.create({
        change_request_id: createdChangeRequest.id,
        review_id: createdReview.id,
        created_by: user.id
      })

      await ChangeRequestService.createChangeRequestComment(
        {
          org_slug: org.slug,
          change_request_id: createdChangeRequest.id,
          review_id: createdReview.id
        },
        mockComment1
      )

      await ChangeRequestService.createChangeRequestComment(
        {
          org_slug: org.slug,
          change_request_id: createdChangeRequest.id,
          review_id: createdReview.id
        },
        mockComment2
      )

      const comments = await ChangeRequestService.getChangeRequestComments({
        review_id: createdReview.id
      })

      expect(comments).toEqual([
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          change_id: null,
          review_id: createdReview.id,
          created_by: user.id,
          content: mockComment1.content,
          created_at: expect.any(Date),
          updated_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          change_id: null,
          review_id: createdReview.id,
          created_by: user.id,
          content: mockComment2.content,
          created_at: expect.any(Date),
          updated_at: expect.any(Date)
        }
      ])
    })

    it('should return all comments for a given review when both change_request_id and review_id are provided', async () => {
      const mockChangeRequest = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Change Request'
      })

      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      const createdReview = await reviewMock.createMockReview({
        change_request_id: createdChangeRequest.id,
        created_by: user.id
      })

      const mockComment1 = changeRequestCommentMock.create({
        change_request_id: createdChangeRequest.id,
        review_id: createdReview.id,
        created_by: user.id
      })

      const mockComment2 = changeRequestCommentMock.create({
        change_request_id: createdChangeRequest.id,
        review_id: createdReview.id,
        created_by: user.id
      })

      await ChangeRequestService.createChangeRequestComment(
        {
          org_slug: org.slug,
          change_request_id: createdChangeRequest.id,
          review_id: createdReview.id
        },
        mockComment1
      )

      await ChangeRequestService.createChangeRequestComment(
        {
          org_slug: org.slug,
          change_request_id: createdChangeRequest.id,
          review_id: createdReview.id
        },
        mockComment2
      )

      const comments = await ChangeRequestService.getChangeRequestComments({
        change_request_id: createdChangeRequest.id,
        review_id: createdReview.id
      })

      expect(comments).toEqual([
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          change_id: null,
          review_id: createdReview.id,
          created_by: user.id,
          content: mockComment1.content,
          created_at: expect.any(Date),
          updated_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          change_id: null,
          review_id: createdReview.id,
          created_by: user.id,
          content: mockComment2.content,
          created_at: expect.any(Date),
          updated_at: expect.any(Date)
        }
      ])
    })

    it('should return all comments for a given change when all three change_request_id, change_id, and review_id are provided', async () => {
      const mockChangeRequest = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Change Request'
      })

      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      const mockTable = tableMock.create({
        connection_id: conn.id,
        raw_database_name: dbEntry.raw_name,
        raw_name: 'test_table',
        raw_schema_name: 'public'
      })

      const createdTable = await MetadataTableService.insertTable(mockTable)

      const mockChange = changeMock.create({
        change_request_id: createdChangeRequest.id,
        connection_id: conn.id,
        metadata_database_name: dbEntry.raw_name,
        metadata_table_name: createdTable.raw_name,
        metadata_schema_name: createdTable.raw_schema_name
      })

      const createdChange = await ChangeService.insertChange(
        getDb(),
        mockChange
      )

      const createdReview = await reviewMock.createMockReview({
        change_request_id: createdChangeRequest.id,
        created_by: user.id
      })

      const mockComment1 = changeRequestCommentMock.create({
        change_request_id: createdChangeRequest.id,
        change_id: createdChange.id,
        review_id: createdReview.id,
        created_by: user.id
      })

      const mockComment2 = changeRequestCommentMock.create({
        change_request_id: createdChangeRequest.id,
        change_id: createdChange.id,
        review_id: createdReview.id,
        created_by: user.id
      })

      await ChangeRequestService.createChangeRequestComment(
        {
          org_slug: org.slug,
          change_request_id: createdChangeRequest.id,
          change_id: createdChange.id,
          review_id: createdReview.id
        },
        mockComment1
      )

      await ChangeRequestService.createChangeRequestComment(
        {
          org_slug: org.slug,
          change_request_id: createdChangeRequest.id,
          change_id: createdChange.id,
          review_id: createdReview.id
        },
        mockComment2
      )

      const comments = await ChangeRequestService.getChangeRequestComments({
        change_request_id: createdChangeRequest.id,
        change_id: createdChange.id,
        review_id: createdReview.id
      })

      expect(comments).toEqual([
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          change_id: createdChange.id,
          review_id: createdReview.id,
          created_by: user.id,
          content: mockComment1.content,
          created_at: expect.any(Date),
          updated_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          change_id: createdChange.id,
          review_id: createdReview.id,
          created_by: user.id,
          content: mockComment2.content,
          created_at: expect.any(Date),
          updated_at: expect.any(Date)
        }
      ])
    })

    it('should throw an error if the database query fails', async () => {
      jest.spyOn(getDb(), 'selectFrom').mockImplementation(() => {
        throw new Error('Failed to get change request comments')
      })

      await expect(
        ChangeRequestService.getChangeRequestComments({
          change_request_id: randomUUID()
        })
      ).rejects.toThrow('Failed to get change request comments')
    })

    it('should throw an error if an invalid change_request_id is provided', async () => {
      const invalidId = 'invalid-id'

      try {
        await ChangeRequestService.getChangeRequestComments({
          change_request_id: invalidId
        })

        fail(
          'Expected getChangeRequestComments fail with invalid change_request_id provided'
        )
      } catch (error) {
        if (!(error instanceof Error)) {
          fail('Caught error is not of type Error')
        }

        expect(error.message).toBe('Failed to get change request comments')
      }
    })

    it('should throw an error if an invalid change_id is provided', async () => {
      const invalidId = 'invalid-id'

      try {
        await ChangeRequestService.getChangeRequestComments({
          change_id: invalidId
        })

        fail(
          'Expected getChangeRequestComments fail with invalid change_id provided'
        )
      } catch (error) {
        if (!(error instanceof Error)) {
          fail('Caught error is not of type Error')
        }

        expect(error.message).toBe('Failed to get change request comments')
      }
    })

    it('should throw an error if an invalid review_id is provided', async () => {
      const invalidId = 'invalid-id'

      try {
        await ChangeRequestService.getChangeRequestComments({
          review_id: invalidId
        })

        fail(
          'Expected getChangeRequestComments fail with invalid review_id provided'
        )
      } catch (error) {
        if (!(error instanceof Error)) {
          fail('Caught error is not of type Error')
        }

        expect(error.message).toBe('Failed to get change request comments')
      }
    })
  })

  describe('deleteChangeRequestComment', () => {
    it('should successfully delete a change request comment', async () => {
      const mockChangeRequest = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Change Request'
      })

      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      const mockComment = changeRequestCommentMock.create({
        change_request_id: createdChangeRequest.id,
        created_by: user.id
      })

      const createdComment =
        await ChangeRequestService.createChangeRequestComment(
          {
            org_slug: org.slug,
            change_request_id: createdChangeRequest.id
          },
          mockComment
        )

      await ChangeRequestService.deleteChangeRequestComment({
        id: createdComment.id,
        userId: user.id,
        change_request_id: createdChangeRequest.id
      })

      const remainingChangeRequestComment =
        await ChangeRequestService.getChangeRequestComment(
          createdChangeRequest.id
        )

      expect(remainingChangeRequestComment).toBeUndefined()
    })
  })

  describe('getChangeRequestId', () => {
    it('should return the change request id for the given change request data', async () => {
      const mockChangeRequest = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Change Request'
      })

      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      const changeRequestId = await ChangeRequestService.getChangeRequestId(
        getDb(),
        {
          connectionId: dbEntry.connection_id,
          databaseRawName: dbEntry.raw_name,
          changeRequestNumber: createdChangeRequest.change_request_number
        }
      )

      expect(changeRequestId).toBe(createdChangeRequest.id)
    })

    it('throws NotFoundError if no change request is found', async () => {
      await expect(async () => {
        await ChangeRequestService.getChangeRequestId(getDb(), {
          connectionId: randomUUID(),
          databaseRawName: 'nothing',
          changeRequestNumber: 100
        })
      }).rejects.toThrow(NotFoundError)
    })
  })

  describe('updateChangeRequest', () => {
    it('updates the change request and sets the updated_at date', async () => {
      const mockChangeRequest = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Change Request',
        labels: [label1, label2],
        reviewers: []
      })

      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      const originalUpdateDate = createdChangeRequest.updated_at

      const result = await ChangeRequestService.updateChangeRequest(
        {
          user_id: createdChangeRequest.created_by,
          changeRequestData: {
            org_slug: org.slug,
            connection_id: createdChangeRequest.connection_id,
            database_name: createdChangeRequest.database_name,
            change_request_number: createdChangeRequest.change_request_number
          }
        },
        {
          title: 'Updated Title',
          description: 'Updated Description',
          labels: [label2],
          reviewers: [orgOwner],
          status: 'approved'
        }
      )

      expect(result).toEqual({
        id: createdChangeRequest.id,
        connection_id: createdChangeRequest.connection_id,
        database_name: createdChangeRequest.database_name,
        change_request_number: createdChangeRequest.change_request_number,
        created_by: createdChangeRequest.created_by,
        created_at: createdChangeRequest.created_at,
        status: 'approved',
        title: 'Updated Title',
        description: 'Updated Description',
        labels: [label2],
        reviewers: [orgOwner],
        changes: [],
        related_issues: [],
        updated_at: expect.any(Date)
      })

      expect(result.updated_at.getTime()).toBeGreaterThan(
        originalUpdateDate.getTime()
      )
    })

    it('writes a timeline event when setting status to closed', async () => {
      const mockChangeRequest = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Change Request',
        labels: [],
        reviewers: []
      })

      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      const result = await ChangeRequestService.updateChangeRequest(
        {
          user_id: createdChangeRequest.created_by,
          changeRequestData: {
            org_slug: org.slug,
            connection_id: createdChangeRequest.connection_id,
            database_name: createdChangeRequest.database_name,
            change_request_number: createdChangeRequest.change_request_number
          }
        },
        {
          status: 'closed'
        }
      )

      expect(result).toEqual({
        id: createdChangeRequest.id,
        connection_id: createdChangeRequest.connection_id,
        database_name: createdChangeRequest.database_name,
        change_request_number: createdChangeRequest.change_request_number,
        created_by: createdChangeRequest.created_by,
        created_at: createdChangeRequest.created_at,
        status: 'closed',
        title: createdChangeRequest.title,
        description: createdChangeRequest.description,
        labels: [],
        reviewers: [],
        related_issues: [],
        changes: [],
        updated_at: expect.any(Date)
      })

      const events = await getDb()
        .selectFrom('change_request_history')
        .selectAll()
        .where('change_request_id', '=', createdChangeRequest.id)
        .orderBy('created_at', 'asc')
        .execute()

      expect(events).toHaveLength(2)
      expect(events[1]).toEqual({
        id: expect.any(String),
        change_request_id: createdChangeRequest.id,
        user_id: createdChangeRequest.created_by,
        action_type: 'CLOSE_CHANGE_REQUEST',
        action_details: { change_request_number: 1 },
        created_at: expect.any(Date)
      })
    })

    it('writes a timeline event when reopened', async () => {
      const mockChangeRequest = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Change Request',
        labels: [],
        reviewers: []
      })

      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      await ChangeRequestService.updateChangeRequest(
        {
          user_id: createdChangeRequest.created_by,
          changeRequestData: {
            org_slug: org.slug,
            connection_id: createdChangeRequest.connection_id,
            database_name: createdChangeRequest.database_name,
            change_request_number: createdChangeRequest.change_request_number
          }
        },
        {
          status: 'closed'
        }
      )

      const result = await ChangeRequestService.updateChangeRequest(
        {
          user_id: createdChangeRequest.created_by,
          changeRequestData: {
            org_slug: org.slug,
            connection_id: createdChangeRequest.connection_id,
            database_name: createdChangeRequest.database_name,
            change_request_number: createdChangeRequest.change_request_number
          }
        },
        {
          status: 'open'
        }
      )

      expect(result).toEqual({
        id: createdChangeRequest.id,
        connection_id: createdChangeRequest.connection_id,
        database_name: createdChangeRequest.database_name,
        change_request_number: createdChangeRequest.change_request_number,
        created_by: createdChangeRequest.created_by,
        created_at: createdChangeRequest.created_at,
        status: 'open',
        title: createdChangeRequest.title,
        description: createdChangeRequest.description,
        labels: [],
        reviewers: [],
        changes: [],
        related_issues: [],
        updated_at: expect.any(Date)
      })

      const events = await getDb()
        .selectFrom('change_request_history')
        .selectAll()
        .where('change_request_id', '=', createdChangeRequest.id)
        .execute()

      expect(events).toHaveLength(3)
      expect(events[2]).toEqual({
        id: expect.any(String),
        change_request_id: createdChangeRequest.id,
        user_id: createdChangeRequest.created_by,
        action_type: 'REOPEN_CHANGE_REQUEST',
        action_details: { change_request_number: 1 },
        created_at: expect.any(Date)
      })
    })
  })

  describe('executeChangeRequest', () => {
    it('creates the execution job, updates status and history', async () => {
      const mockChangeRequest = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test success'
      })

      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      await reviewMock.createMockReview({
        created_by: user2.id,
        change_request_id: createdChangeRequest.id,
        event_type: 'APPROVE'
      })

      const result = await ChangeRequestService.executeChangeRequest({
        connectionId: mockChangeRequest.connection_id,
        databaseRawName: dbEntry.raw_name,
        changeRequestNumber: createdChangeRequest.change_request_number,
        userId: user.id
      })

      expect(result.changeRequest.id).toBe(createdChangeRequest.id)
      expect(result.job.change_request_id).toBe(createdChangeRequest.id)
      expect(result.job.status).toBe('PENDING')
    })

    it('throws NotFoundError if the change request cannot be found', async () => {
      await expect(async () => {
        await ChangeRequestService.executeChangeRequest({
          connectionId: randomUUID(),
          databaseRawName: 'nothing',
          changeRequestNumber: 1010,
          userId: user.id
        })
      }).rejects.toThrow(NotFoundError)
    })

    it('throws NotApprovedError if the change request has not been approved', async () => {
      const mockChangeRequest = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Change Request'
      })

      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      await expect(async () => {
        await ChangeRequestService.executeChangeRequest({
          connectionId: mockChangeRequest.connection_id,
          databaseRawName: dbEntry.raw_name,
          changeRequestNumber: createdChangeRequest.change_request_number,
          userId: user.id
        })
      }).rejects.toThrow(NotApprovedError)
    })

    it('throws an error if the change request job already exists', async () => {
      const mockChangeRequest = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Change Request'
      })

      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      await reviewMock.createMockReview({
        created_by: user2.id,
        change_request_id: createdChangeRequest.id,
        event_type: 'APPROVE'
      })

      await ChangeRequestService.executeChangeRequest({
        connectionId: mockChangeRequest.connection_id,
        databaseRawName: dbEntry.raw_name,
        changeRequestNumber: createdChangeRequest.change_request_number,
        userId: user.id
      })

      await expect(async () => {
        await ChangeRequestService.executeChangeRequest({
          connectionId: mockChangeRequest.connection_id,
          databaseRawName: dbEntry.raw_name,
          changeRequestNumber: createdChangeRequest.change_request_number,
          userId: user.id
        })
      }).rejects.toThrow(JobExistsError)
    })
  })
})
