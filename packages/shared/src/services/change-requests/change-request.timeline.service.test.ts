import { randomUUID } from 'node:crypto'

import {
  createKysely,
  disconnectKysely,
  getDb,
  getConfig,
  logger
} from '../../'
import { ChangeRequestCommentMock } from '../../mocks/change-requests/change-request-comment.mock'
import { ChangeRequestMock } from '../../mocks/change-requests/change-request.mock'
import { ConnectionMock } from '../../mocks/connection.mock'
import { LabelMock } from '../../mocks/label.mock'
import { MetadataDatabaseMock } from '../../mocks/metadata.mock'
import { OrganizationMock } from '../../mocks/org.mock'
import { ReviewMock } from '../../mocks/review.mock'
import { UserMock } from '../../mocks/user.mock'
import { addChangeRequestHistory } from '../change-requests/change-request.service'
import * as ConnectionService from '../connection.service'
import * as MetadataDatabaseService from '../kysely/metadata/database.service'
import * as LabelService from '../label.service'
import * as OrganizationService from '../org.service'
import * as UserService from '../user.service'

import * as ChangeRequestService from './change-request.service'
import * as ChangeRequestTimelineService from './change-request.timeline.service'
import * as ReviewService from './review.service'

import type { Label } from '../../schemas/label.schema'
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

  const orgMember2 = {
    user: {
      id: user2.id,
      username: user2.username,
      name: user2.name,
      picture: user2.picture
    },
    role: {
      id: 1,
      name: 'member'
    }
  } satisfies OrganizationMember

  const orgMember3 = {
    user: {
      id: user3.id,
      username: user3.username,
      name: user3.name,
      picture: user3.picture
    },
    role: {
      id: 1,
      name: 'member'
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
    await reviewMock.removeAll()
    await changeRequestMock.removeAll()
  })

  afterAll(async () => {
    await changeRequestCommentMock.removeAll()
    await reviewMock.removeAll()
    await changeRequestMock.removeAll()
    await labelMock.removeAll()
    await connMock.removeAll()
    await dbMock.removeAll()
    await orgMock.removeAll(true)
    await userMock.removeAll()

    await disconnectKysely()
  })

  describe('getChangeRequestTimeline', () => {
    it('should return timeline events for change request creation without an initial description', async () => {
      const mockChangeRequest = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Change Request'
      })

      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      const timeline =
        await ChangeRequestTimelineService.getChangeRequestTimeline(
          createdChangeRequest.id
        )

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(1)
      expect(timeline).toEqual([
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'CREATE_CHANGE_REQUEST',
          action_details: { change_request_number: 1 },
          created_at: expect.any(Date)
        }
      ])
    })

    // NOTE: We do not currently emit an ADD_DESCRIPTION event on change request creation
    it('should return timeline events for change request creation with an initial description', async () => {
      const mockChangeRequest = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Change Request',
        description: 'This is a test change request.'
      })

      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      const timeline =
        await ChangeRequestTimelineService.getChangeRequestTimeline(
          createdChangeRequest.id
        )

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(1)
      expect(timeline).toEqual([
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'CREATE_CHANGE_REQUEST',
          action_details: { change_request_number: 1 },
          created_at: expect.any(Date)
        }
      ])
    })

    it('should return timeline events for change request creation with initial labels', async () => {
      const mockChangeRequest = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Change Request',
        description: 'This is a test change request.',
        labels: [label1, label2, label3]
      })

      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      const timeline =
        await ChangeRequestTimelineService.getChangeRequestTimeline(
          createdChangeRequest.id
        )

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(4)
      expect(timeline.map(event => event.action_type)).toEqual([
        'CREATE_CHANGE_REQUEST',
        'ADD_LABEL',
        'ADD_LABEL',
        'ADD_LABEL'
      ])
      expect(
        timeline
          .filter(event => event.action_type === 'ADD_LABEL')
          .map(event => event.action_details.label)
      ).toEqual(expect.arrayContaining([label1, label2, label3]))
    })

    it('should return timeline events for change request creation with initial reviewers', async () => {
      const mockChangeRequest = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Change Request',
        description: 'This is a test change request.',
        reviewers: [orgOwner, orgMember2, orgMember3]
      })

      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      const timeline =
        await ChangeRequestTimelineService.getChangeRequestTimeline(
          createdChangeRequest.id
        )

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(4)
      expect(timeline.map(event => event.action_type)).toEqual([
        'CREATE_CHANGE_REQUEST',
        'ADD_REVIEWER',
        'ADD_REVIEWER',
        'ADD_REVIEWER'
      ])
      expect(
        timeline
          .filter(event => event.action_type === 'ADD_REVIEWER')
          .map(event => event.action_details.reviewer)
      ).toEqual(expect.arrayContaining([orgOwner, orgMember2, orgMember3]))
    })

    it('should return timeline events for title updates', async () => {
      const mockChangeRequest = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Change Request'
      })

      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      const where = {
        user_id: user.id,
        changeRequestData: {
          org_slug: org.slug,
          connection_id: dbEntry.connection_id,
          database_name: dbEntry.raw_name,
          change_request_number: createdChangeRequest.change_request_number
        }
      }

      await ChangeRequestService.updateChangeRequest(where, {
        title: 'Updated Test Change Request'
      })

      const timeline =
        await ChangeRequestTimelineService.getChangeRequestTimeline(
          createdChangeRequest.id
        )

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(2)
      expect(timeline).toEqual([
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'CREATE_CHANGE_REQUEST',
          action_details: { change_request_number: 1 },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'UPDATE_TITLE',
          action_details: {
            curr: 'Updated Test Change Request',
            prev: 'Test Change Request'
          },
          created_at: expect.any(Date)
        }
      ])
    })

    it('should return timeline events for description updates', async () => {
      const mockChangeRequest = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Change Request',
        description: 'This is a test change request.'
      })

      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      const where = {
        user_id: user.id,
        changeRequestData: {
          org_slug: org.slug,
          connection_id: dbEntry.connection_id,
          database_name: dbEntry.raw_name,
          change_request_number: createdChangeRequest.change_request_number
        }
      }

      await ChangeRequestService.updateChangeRequest(where, {
        description: 'This is an updated test change request.'
      })

      const timeline =
        await ChangeRequestTimelineService.getChangeRequestTimeline(
          createdChangeRequest.id
        )

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(2)
      expect(timeline).toEqual([
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'CREATE_CHANGE_REQUEST',
          action_details: { change_request_number: 1 },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'UPDATE_DESCRIPTION',
          action_details: {
            curr: 'This is an updated test change request.',
            prev: 'This is a test change request.'
          },
          created_at: expect.any(Date)
        }
      ])
    })

    it('should return timeline events for status updates', async () => {
      const mockChangeRequest = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Change Request',
        description: 'This is a test change request.'
      })

      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      const where = {
        user_id: user.id,
        changeRequestData: {
          org_slug: org.slug,
          connection_id: dbEntry.connection_id,
          database_name: dbEntry.raw_name,
          change_request_number: createdChangeRequest.change_request_number
        }
      }

      await ChangeRequestService.updateChangeRequest(where, {
        status: 'closed'
      })
      await ChangeRequestService.updateChangeRequest(where, { status: 'open' })
      await ChangeRequestService.updateChangeRequest(where, {
        status: 'closed'
      })

      const timeline =
        await ChangeRequestTimelineService.getChangeRequestTimeline(
          createdChangeRequest.id
        )

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(4)
      expect(timeline).toEqual([
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'CREATE_CHANGE_REQUEST',
          action_details: { change_request_number: 1 },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'CLOSE_CHANGE_REQUEST',
          action_details: { change_request_number: 1 },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'REOPEN_CHANGE_REQUEST',
          action_details: { change_request_number: 1 },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'CLOSE_CHANGE_REQUEST',
          action_details: { change_request_number: 1 },
          created_at: expect.any(Date)
        }
      ])
    })

    it('should return timeline events for label additions', async () => {
      const mockChangeRequest = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Change Request',
        description: 'This is a test change request.'
      })

      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      const where = {
        user_id: user.id,
        changeRequestData: {
          org_slug: org.slug,
          connection_id: dbEntry.connection_id,
          database_name: dbEntry.raw_name,
          change_request_number: createdChangeRequest.change_request_number
        }
      }

      await ChangeRequestService.updateChangeRequest(where, {
        labels: [label1]
      })

      const timeline =
        await ChangeRequestTimelineService.getChangeRequestTimeline(
          createdChangeRequest.id
        )

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(2)
      expect(timeline).toEqual([
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'CREATE_CHANGE_REQUEST',
          action_details: { change_request_number: 1 },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'ADD_LABEL',
          action_details: { label: label1 },
          created_at: expect.any(Date)
        }
      ])
    })

    it('should return timeline events for multiple label additions', async () => {
      const mockChangeRequest = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Change Request',
        description: 'This is a test change request.'
      })

      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      const where = {
        user_id: user.id,
        changeRequestData: {
          org_slug: org.slug,
          connection_id: dbEntry.connection_id,
          database_name: dbEntry.raw_name,
          change_request_number: createdChangeRequest.change_request_number
        }
      }

      await ChangeRequestService.updateChangeRequest(where, {
        labels: [label1]
      })
      await ChangeRequestService.updateChangeRequest(where, {
        labels: [label1, label2, label3]
      })

      const timeline =
        await ChangeRequestTimelineService.getChangeRequestTimeline(
          createdChangeRequest.id
        )

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(4)
      expect(timeline.map(event => event.action_type)).toEqual([
        'CREATE_CHANGE_REQUEST',
        'ADD_LABEL',
        'ADD_LABEL',
        'ADD_LABEL'
      ])
      expect(
        timeline
          .filter(event => event.action_type === 'ADD_LABEL')
          .map(event => event.action_details.label)
      ).toEqual(expect.arrayContaining([label1, label2, label3]))
    })

    it('should return timeline events for label removals', async () => {
      const mockChangeRequest = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Change Request',
        description: 'This is a test change request.'
      })

      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      const where = {
        user_id: user.id,
        changeRequestData: {
          org_slug: org.slug,
          connection_id: dbEntry.connection_id,
          database_name: dbEntry.raw_name,
          change_request_number: createdChangeRequest.change_request_number
        }
      }

      await ChangeRequestService.updateChangeRequest(where, {
        labels: [label1]
      })
      await ChangeRequestService.updateChangeRequest(where, { labels: [] })

      const timeline =
        await ChangeRequestTimelineService.getChangeRequestTimeline(
          createdChangeRequest.id
        )

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(3)
      expect(timeline).toEqual([
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'CREATE_CHANGE_REQUEST',
          action_details: { change_request_number: 1 },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'ADD_LABEL',
          action_details: { label: label1 },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'REMOVE_LABEL',
          action_details: { label: label1 },
          created_at: expect.any(Date)
        }
      ])
    })

    it('should return timeline events for reviewer additions', async () => {
      const mockChangeRequest = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Change Request',
        description: 'This is a test change request.'
      })

      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      const where = {
        user_id: user.id,
        changeRequestData: {
          org_slug: org.slug,
          connection_id: dbEntry.connection_id,
          database_name: dbEntry.raw_name,
          change_request_number: createdChangeRequest.change_request_number
        }
      }

      await ChangeRequestService.updateChangeRequest(where, {
        reviewers: [orgOwner]
      })

      const timeline =
        await ChangeRequestTimelineService.getChangeRequestTimeline(
          createdChangeRequest.id
        )

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(2)
      expect(timeline).toEqual([
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'CREATE_CHANGE_REQUEST',
          action_details: { change_request_number: 1 },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'ADD_REVIEWER',
          action_details: { reviewer: orgOwner },
          created_at: expect.any(Date)
        }
      ])
    })

    it('should return timeline events for multiple reviewer additions', async () => {
      const mockChangeRequest = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Change Request',
        description: 'This is a test change request.'
      })

      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      const where = {
        user_id: user.id,
        changeRequestData: {
          org_slug: org.slug,
          connection_id: dbEntry.connection_id,
          database_name: dbEntry.raw_name,
          change_request_number: createdChangeRequest.change_request_number
        }
      }

      await ChangeRequestService.updateChangeRequest(where, {
        reviewers: [orgOwner]
      })
      await ChangeRequestService.updateChangeRequest(where, {
        reviewers: [orgOwner, orgMember2, orgMember3]
      })

      const timeline =
        await ChangeRequestTimelineService.getChangeRequestTimeline(
          createdChangeRequest.id
        )

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(4)
      expect(timeline.map(event => event.action_type)).toEqual([
        'CREATE_CHANGE_REQUEST',
        'ADD_REVIEWER',
        'ADD_REVIEWER',
        'ADD_REVIEWER'
      ])
      expect(
        timeline
          .filter(event => event.action_type === 'ADD_REVIEWER')
          .map(event => event.action_details.reviewer)
      ).toEqual(expect.arrayContaining([orgOwner, orgMember2, orgMember3]))
    })

    it('should return timeline events for reviewer removals', async () => {
      const mockChangeRequest = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Change Request',
        description: 'This is a test change request.'
      })

      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      const where = {
        user_id: user.id,
        changeRequestData: {
          org_slug: org.slug,
          connection_id: dbEntry.connection_id,
          database_name: dbEntry.raw_name,
          change_request_number: createdChangeRequest.change_request_number
        }
      }

      await ChangeRequestService.updateChangeRequest(where, {
        reviewers: [orgOwner]
      })
      await ChangeRequestService.updateChangeRequest(where, { reviewers: [] })

      const timeline =
        await ChangeRequestTimelineService.getChangeRequestTimeline(
          createdChangeRequest.id
        )

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(3)
      expect(timeline).toEqual([
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'CREATE_CHANGE_REQUEST',
          action_details: { change_request_number: 1 },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'ADD_REVIEWER',
          action_details: { reviewer: orgOwner },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'REMOVE_REVIEWER',
          action_details: { reviewer: orgOwner },
          created_at: expect.any(Date)
        }
      ])
    })

    it('should return timeline events for comment additions', async () => {
      const mockChangeRequest = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Change Request',
        description: 'This is a test change request.'
      })

      const mockChangeRequestComment = changeRequestCommentMock.create({
        change_request_id: mockChangeRequest.id,
        created_by: user.id,
        content: 'This is a test comment.'
      })

      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      const createdChangeRequestComment =
        await ChangeRequestService.createChangeRequestComment(
          { org_slug: org.slug, change_request_id: createdChangeRequest.id },
          mockChangeRequestComment
        )

      const timeline =
        await ChangeRequestTimelineService.getChangeRequestTimeline(
          createdChangeRequest.id
        )

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(2)
      expect(timeline).toEqual([
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'CREATE_CHANGE_REQUEST',
          action_details: { change_request_number: 1 },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'ADD_COMMENT',
          action_details: {
            comment_id: createdChangeRequestComment.id,
            change_id: createdChangeRequestComment.change_id,
            review_id: createdChangeRequestComment.review_id,
            content: createdChangeRequestComment.content
          },
          created_at: expect.any(Date)
        }
      ])
    })

    it('should return timeline events for multiple comment additions', async () => {
      const mockChangeRequest = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Change Request',
        description: 'This is a test change request.'
      })

      const mockChangeRequestComment1 = changeRequestCommentMock.create({
        change_request_id: mockChangeRequest.id,
        created_by: user.id,
        content: 'This is a test comment.'
      })

      const mockChangeRequestComment2 = changeRequestCommentMock.create({
        change_request_id: mockChangeRequest.id,
        created_by: user.id,
        content: 'This is another test comment.'
      })

      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      const createdChangeRequestComment1 =
        await ChangeRequestService.createChangeRequestComment(
          { org_slug: org.slug, change_request_id: createdChangeRequest.id },
          mockChangeRequestComment1
        )

      const createdChangeRequestComment2 =
        await ChangeRequestService.createChangeRequestComment(
          { org_slug: org.slug, change_request_id: createdChangeRequest.id },
          mockChangeRequestComment2
        )

      const timeline =
        await ChangeRequestTimelineService.getChangeRequestTimeline(
          createdChangeRequest.id
        )

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(3)
      expect(timeline).toEqual([
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'CREATE_CHANGE_REQUEST',
          action_details: { change_request_number: 1 },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'ADD_COMMENT',
          action_details: {
            comment_id: createdChangeRequestComment1.id,
            change_id: createdChangeRequestComment1.change_id,
            review_id: createdChangeRequestComment1.review_id,
            content: createdChangeRequestComment1.content
          },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'ADD_COMMENT',
          action_details: {
            comment_id: createdChangeRequestComment2.id,
            change_id: createdChangeRequestComment2.change_id,
            review_id: createdChangeRequestComment2.review_id,
            content: createdChangeRequestComment2.content
          },
          created_at: expect.any(Date)
        }
      ])
    })

    it('should return timeline events for comment updates', async () => {
      const mockChangeRequest = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Change Request',
        description: 'This is a test change request.'
      })

      const mockChangeRequestComment = changeRequestCommentMock.create({
        change_request_id: mockChangeRequest.id,
        created_by: user.id,
        content: 'This is a test comment.'
      })

      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      const createdChangeRequestComment =
        await ChangeRequestService.createChangeRequestComment(
          { org_slug: org.slug, change_request_id: createdChangeRequest.id },
          mockChangeRequestComment
        )

      const updatedChangeRequestComment =
        await ChangeRequestService.updateChangeRequestComment({
          id: createdChangeRequestComment.id,
          change_request_id: createdChangeRequest.id,
          content: 'This is a test comment, edited.'
        })

      const timeline =
        await ChangeRequestTimelineService.getChangeRequestTimeline(
          createdChangeRequest.id
        )

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(2)
      expect(timeline).toEqual([
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'CREATE_CHANGE_REQUEST',
          action_details: { change_request_number: 1 },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'UPDATE_COMMENT',
          action_details: {
            comment_id: createdChangeRequestComment.id,
            change_id: createdChangeRequestComment.change_id,
            review_id: createdChangeRequestComment.review_id,
            content: updatedChangeRequestComment.content
          },
          created_at: expect.any(Date)
        }
      ])
    })

    it('should filter out timeline events for comment deletions', async () => {
      const mockChangeRequest = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Change Request',
        description: 'This is a test change request.'
      })

      const mockChangeRequestComment = changeRequestCommentMock.create({
        change_request_id: mockChangeRequest.id,
        created_by: user.id,
        content: 'This is a test comment.'
      })

      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      const createdChangeRequestComment =
        await ChangeRequestService.createChangeRequestComment(
          { org_slug: org.slug, change_request_id: createdChangeRequest.id },
          mockChangeRequestComment
        )

      await ChangeRequestService.deleteChangeRequestComment({
        id: createdChangeRequestComment.id,
        userId: user.id,
        change_request_id: createdChangeRequest.id
      })

      const timeline =
        await ChangeRequestTimelineService.getChangeRequestTimeline(
          createdChangeRequest.id
        )

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(1)
      expect(timeline).toEqual([
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'CREATE_CHANGE_REQUEST',
          action_details: { change_request_number: 1 },
          created_at: expect.any(Date)
        }
      ])
    })

    it('should return timeline events for review additions', async () => {
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
        created_by: user.id,
        text: 'Test Review'
      })

      const timeline =
        await ChangeRequestTimelineService.getChangeRequestTimeline(
          createdChangeRequest.id
        )

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(2)
      expect(timeline).toEqual([
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'CREATE_CHANGE_REQUEST',
          action_details: { change_request_number: 1 },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'ADD_REVIEW',
          action_details: {
            review_id: createdReview.id,
            event_type: 'COMMENT',
            text: 'Test Review'
          },
          created_at: expect.any(Date)
        }
      ])
    })

    it('should return timeline events for multiple review additions', async () => {
      const mockChangeRequest = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Change Request'
      })

      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      const createdReview1 = await reviewMock.createMockReview({
        change_request_id: createdChangeRequest.id,
        created_by: user.id,
        text: 'Test Review 1'
      })
      const createdReview2 = await reviewMock.createMockReview({
        change_request_id: createdChangeRequest.id,
        created_by: user.id,
        event_type: 'APPROVE',
        text: 'Test Review 2'
      })

      const timeline =
        await ChangeRequestTimelineService.getChangeRequestTimeline(
          createdChangeRequest.id
        )

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(3)
      expect(timeline).toEqual([
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'CREATE_CHANGE_REQUEST',
          action_details: { change_request_number: 1 },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'ADD_REVIEW',
          action_details: {
            review_id: createdReview1.id,
            event_type: 'COMMENT',
            text: 'Test Review 1'
          },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'ADD_REVIEW',
          action_details: {
            review_id: createdReview2.id,
            event_type: 'APPROVE',
            text: 'Test Review 2'
          },
          created_at: expect.any(Date)
        }
      ])
    })

    it('should return timeline events for review updates', async () => {
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
        created_by: user.id,
        text: 'Test Review'
      })

      const updatedReview = await ReviewService.updateReview(
        { id: createdReview.id, change_request_id: createdChangeRequest.id },
        { text: 'Test Review, edited.' }
      )

      const timeline =
        await ChangeRequestTimelineService.getChangeRequestTimeline(
          createdChangeRequest.id
        )

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(2)
      expect(timeline).toEqual([
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'CREATE_CHANGE_REQUEST',
          action_details: { change_request_number: 1 },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'UPDATE_REVIEW',
          action_details: {
            review_id: updatedReview.id,
            event_type: 'COMMENT',
            text: updatedReview.text
          },
          created_at: expect.any(Date)
        }
      ])
    })

    it('should return change request timeline for a change request with a complicated change request history', async () => {
      const mockChangeRequest = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Change Request',
        labels: [label1]
      })

      // Event 1, 2: CREATE_CHANGE_REQUEST, ADD_LABEL
      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      const where = {
        user_id: user.id,
        changeRequestData: {
          org_slug: org.slug,
          connection_id: dbEntry.connection_id,
          database_name: dbEntry.raw_name,
          change_request_number: createdChangeRequest.change_request_number
        }
      }

      // Event 3: REMOVE_LABEL
      await ChangeRequestService.updateChangeRequest(where, { labels: [] })

      // Event 4: ADD_REVIEWER
      await ChangeRequestService.updateChangeRequest(where, {
        reviewers: [orgOwner]
      })

      // Event 5: REMOVE_REVIEWER
      await ChangeRequestService.updateChangeRequest(where, { reviewers: [] })

      // Event 6, 7, 8: ADD_LABEL, ADD_LABEL, ADD_LABEL
      await ChangeRequestService.updateChangeRequest(where, {
        labels: [label1, label2, label3]
      })

      // Event 9, 10: REMOVE_LABEL, REMOVE_LABEL
      await ChangeRequestService.updateChangeRequest(where, {
        labels: [label1]
      })

      // Event 11: ADD_REVIEWER
      await ChangeRequestService.updateChangeRequest(where, {
        reviewers: [orgOwner]
      })

      // Event 12: UPDATE_TITLE
      await ChangeRequestService.updateChangeRequest(where, {
        title: 'Updated Test Change Request'
      })

      // Event 13: UPDATE_DESCRIPTION
      await ChangeRequestService.updateChangeRequest(where, {
        description: 'Updated description'
      })

      const comment1Id = randomUUID()
      const comment2Id = randomUUID()
      const comment3Id = randomUUID()

      // Event 14a: UPDATE_COMMENT (ultimately updated by 14b)
      await ChangeRequestService.createChangeRequestComment(
        { org_slug: org.slug, change_request_id: createdChangeRequest.id },
        {
          id: comment1Id,
          created_by: user.id,
          content: 'First comment.'
        }
      )
      // Event 14b: UPDATE_COMMENT
      await ChangeRequestService.updateChangeRequestComment({
        id: comment1Id,
        change_request_id: createdChangeRequest.id,
        content: 'First comment, edited.'
      })

      // Comment 2 is not a timeline event - ultimately gets deleted
      await ChangeRequestService.createChangeRequestComment(
        { org_slug: org.slug, change_request_id: createdChangeRequest.id },
        {
          id: comment2Id,
          created_by: user.id,
          content: 'Second comment.'
        }
      )

      // Comment 2 is not a timeline event - ultimately gets deleted
      await ChangeRequestService.updateChangeRequestComment({
        id: comment2Id,
        change_request_id: createdChangeRequest.id,
        content: 'Second comment, edited.'
      })

      // Event 15a: UPDATE_COMMENT (ultimately updated by 15b and 15c)
      await ChangeRequestService.createChangeRequestComment(
        { org_slug: org.slug, change_request_id: createdChangeRequest.id },
        {
          id: comment3Id,
          created_by: user.id,
          content: 'Third comment.'
        }
      )

      // Event 15b: UPDATE_COMMENT (ultimately updated by 15c)
      await ChangeRequestService.updateChangeRequestComment({
        id: comment3Id,
        change_request_id: createdChangeRequest.id,
        content: 'Third comment, first edit.'
      })

      // Event 16a: ADD_REVIEW (ultimately updated by 16b)
      const createdReview = await reviewMock.createMockReview({
        change_request_id: createdChangeRequest.id,
        created_by: user.id
      })

      // Event 15c: UPDATE_COMMENT
      await ChangeRequestService.updateChangeRequestComment({
        id: comment3Id,
        change_request_id: createdChangeRequest.id,
        content: 'Third comment, second edit.'
      })

      await ChangeRequestService.deleteChangeRequestComment({
        id: comment2Id,
        userId: user.id,
        change_request_id: createdChangeRequest.id
      })

      // EVENT 17: ADD_COMMENT
      await ChangeRequestService.createChangeRequestComment(
        { org_slug: org.slug, change_request_id: createdChangeRequest.id },
        {
          id: randomUUID(),
          created_by: user.id,
          content: 'Fourth comment.'
        }
      )

      // Event 16b: UPDATE_REVIEW
      await ReviewService.updateReview(
        { id: createdReview.id, change_request_id: createdChangeRequest.id },
        { text: 'Updated review.' }
      )

      // Event 18: ADD_CHANGE
      const addChangeId = randomUUID()
      await addChangeRequestHistory({
        history: {
          id: randomUUID(),
          change_request_id: createdChangeRequest.id,
          action_type: 'ADD_CHANGE',
          action_details: {
            change: {
              id: addChangeId,
              change_request_id: createdChangeRequest.id,
              connection_id: dbEntry.connection_id,
              index: 0,
              action: 'ADD',
              metadata_database_name: 'my_test_database',
              metadata_schema_name: 'my_test_schema',
              metadata_table_name: 'my_test_table',
              fields: [
                {
                  column_name: 'id',
                  string_value: 'uno',
                  id: randomUUID(),
                  change_id: addChangeId,
                  is_value_null: false
                }
              ],
              primary_keys: [],
              previous_fields: []
            }
          },
          created_at: new Date()
        },
        userId: user.id
      })

      // Event 19: UPDATE_CHANGE
      await addChangeRequestHistory({
        history: {
          id: randomUUID(),
          change_request_id: createdChangeRequest.id,
          action_type: 'UPDATE_CHANGE',
          action_details: {
            change: {
              id: addChangeId,
              change_request_id: createdChangeRequest.id,
              connection_id: dbEntry.connection_id,
              index: 0,
              action: 'ADD',
              metadata_database_name: 'my_test_database',
              metadata_schema_name: 'my_test_schema',
              metadata_table_name: 'my_test_table',
              fields: [
                {
                  column_name: 'id',
                  string_value: 'one',
                  id: randomUUID(),
                  change_id: addChangeId,
                  is_value_null: false
                }
              ],
              primary_keys: [],
              previous_fields: []
            }
          },
          created_at: new Date()
        },
        userId: user.id
      })

      // Event 19: DELETE_CHANGE
      await addChangeRequestHistory({
        history: {
          id: randomUUID(),
          change_request_id: createdChangeRequest.id,
          action_type: 'DELETE_CHANGE',
          action_details: {
            change: {
              id: addChangeId,
              change_request_id: createdChangeRequest.id,
              connection_id: dbEntry.connection_id,
              index: 0,
              action: 'ADD',
              metadata_database_name: 'my_test_database',
              metadata_schema_name: 'my_test_schema',
              metadata_table_name: 'my_test_table',
              fields: [
                {
                  column_name: 'id',
                  string_value: 'one',
                  id: randomUUID(),
                  change_id: addChangeId,
                  is_value_null: false
                }
              ],
              primary_keys: [],
              previous_fields: []
            }
          },
          created_at: new Date()
        },
        userId: user.id
      })

      const timeline =
        await ChangeRequestTimelineService.getChangeRequestTimeline(
          createdChangeRequest.id
        )

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(20)
      expect(timeline.map(event => event.action_type)).toEqual([
        'CREATE_CHANGE_REQUEST',
        'ADD_LABEL',
        'REMOVE_LABEL',
        'ADD_REVIEWER',
        'REMOVE_REVIEWER',
        'ADD_LABEL',
        'ADD_LABEL',
        'ADD_LABEL',
        'REMOVE_LABEL',
        'REMOVE_LABEL',
        'ADD_REVIEWER',
        'UPDATE_TITLE',
        'UPDATE_DESCRIPTION',
        'UPDATE_COMMENT',
        'UPDATE_COMMENT',
        'UPDATE_REVIEW',
        'ADD_COMMENT',
        'ADD_CHANGE',
        'UPDATE_CHANGE',
        'DELETE_CHANGE'
      ])
    })

    it('should return change request timeline with an updated label, post-label update', async () => {
      const mockChangeRequest = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Change Request',
        labels: [label1]
      })

      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      const where = {
        user_id: user.id,
        changeRequestData: {
          org_slug: org.slug,
          connection_id: dbEntry.connection_id,
          database_name: dbEntry.raw_name,
          change_request_number: createdChangeRequest.change_request_number
        }
      }

      await ChangeRequestService.updateChangeRequest(where, {
        labels: [label2]
      })

      const timelinePreUpdate =
        await ChangeRequestTimelineService.getChangeRequestTimeline(
          createdChangeRequest.id
        )

      expect(timelinePreUpdate).toBeDefined()
      expect(timelinePreUpdate).toHaveLength(4)
      expect(timelinePreUpdate.map(event => event.action_type).sort()).toEqual(
        [
          'CREATE_CHANGE_REQUEST',
          'ADD_LABEL',
          'ADD_LABEL',
          'REMOVE_LABEL'
        ].sort()
      )

      const lastUpdatedLabelEventBefore = timelinePreUpdate.filter(
        event =>
          event.action_type === 'ADD_LABEL' &&
          event.action_details.label.id === label2.id
      )

      expect(lastUpdatedLabelEventBefore).toHaveLength(1)
      expect(lastUpdatedLabelEventBefore[0].action_details).toEqual({
        label: label2
      })

      const updatedLabel = {
        ...label2,
        name: 'Updated Label'
      } satisfies Label

      await LabelService.updateDatabaseLabel(updatedLabel)

      await ChangeRequestService.updateChangeRequest(where, { labels: [] })

      const timelinePostUpdate =
        await ChangeRequestTimelineService.getChangeRequestTimeline(
          createdChangeRequest.id
        )

      expect(timelinePostUpdate).toBeDefined()
      expect(timelinePostUpdate).toHaveLength(5)
      expect(timelinePostUpdate.map(event => event.action_type).sort()).toEqual(
        [
          'CREATE_CHANGE_REQUEST',
          'ADD_LABEL',
          'ADD_LABEL',
          'REMOVE_LABEL',
          'REMOVE_LABEL'
        ].sort()
      )
      const lastUpdatedLabelEventAfter = timelinePostUpdate.filter(
        event =>
          event.action_type === 'ADD_LABEL' &&
          event.action_details.label.id === label2.id
      )

      expect(lastUpdatedLabelEventAfter).toHaveLength(1)
      expect(lastUpdatedLabelEventAfter[0].action_details).toEqual({
        label: updatedLabel
      })
    })

    it('should return correctly ordered timeline events for multiple comment creation/deletion', async () => {
      const mockChangeRequest = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Change Request',
        description: 'This is a test change request.'
      })

      const mockChangeRequestComment = changeRequestCommentMock.create({
        change_request_id: mockChangeRequest.id,
        created_by: user.id,
        content: 'This is the first comment.'
      })

      const mockChangeRequestComment2 = changeRequestCommentMock.create({
        change_request_id: mockChangeRequest.id,
        created_by: user2.id,
        content: 'This is the second comment.'
      })

      const mockChangeRequestComment3 = changeRequestCommentMock.create({
        change_request_id: mockChangeRequest.id,
        created_by: user2.id,
        content: 'This is the third comment.'
      })

      const createdChangeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      const createdChangeRequestComment1 =
        await ChangeRequestService.createChangeRequestComment(
          { org_slug: org.slug, change_request_id: createdChangeRequest.id },
          mockChangeRequestComment
        )

      const createdChangeRequestComment2 =
        await ChangeRequestService.createChangeRequestComment(
          { org_slug: org.slug, change_request_id: createdChangeRequest.id },
          mockChangeRequestComment2
        )

      const createdChangeRequestComment3 =
        await ChangeRequestService.createChangeRequestComment(
          { org_slug: org.slug, change_request_id: createdChangeRequest.id },
          mockChangeRequestComment3
        )

      const preTimeline =
        await ChangeRequestTimelineService.getChangeRequestTimeline(
          createdChangeRequest.id
        )

      expect(preTimeline).toHaveLength(4)
      expect(preTimeline).toEqual([
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'CREATE_CHANGE_REQUEST',
          action_details: { change_request_number: 1 },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'ADD_COMMENT',
          action_details: {
            comment_id: createdChangeRequestComment1.id,
            change_id: createdChangeRequestComment1.change_id,
            review_id: createdChangeRequestComment1.review_id,
            content: createdChangeRequestComment1.content
          },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user2.id,
            username: user2.username,
            name: user2.name,
            picture: user2.picture
          },
          action_type: 'ADD_COMMENT',
          action_details: {
            comment_id: createdChangeRequestComment2.id,
            change_id: createdChangeRequestComment2.change_id,
            review_id: createdChangeRequestComment2.review_id,
            content: createdChangeRequestComment2.content
          },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user2.id,
            username: user2.username,
            name: user2.name,
            picture: user2.picture
          },
          action_type: 'ADD_COMMENT',
          action_details: {
            comment_id: createdChangeRequestComment3.id,
            change_id: createdChangeRequestComment3.change_id,
            review_id: createdChangeRequestComment3.review_id,
            content: createdChangeRequestComment3.content
          },
          created_at: expect.any(Date)
        }
      ])

      const updatedChangeRequestComment =
        await ChangeRequestService.updateChangeRequestComment({
          id: createdChangeRequestComment2.id,
          change_request_id: createdChangeRequest.id,
          content: 'This is the second comment, edited.'
        })

      expect(updatedChangeRequestComment).toBeDefined()

      const timeline =
        await ChangeRequestTimelineService.getChangeRequestTimeline(
          createdChangeRequest.id
        )

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(4)
      expect(timeline).toEqual([
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'CREATE_CHANGE_REQUEST',
          action_details: { change_request_number: 1 },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'ADD_COMMENT',
          action_details: {
            comment_id: createdChangeRequestComment1.id,
            change_id: createdChangeRequestComment1.change_id,
            review_id: createdChangeRequestComment1.review_id,
            content: createdChangeRequestComment1.content
          },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user2.id,
            username: user2.username,
            name: user2.name,
            picture: user2.picture
          },
          action_type: 'UPDATE_COMMENT',
          action_details: {
            comment_id: createdChangeRequestComment2.id,
            change_id: createdChangeRequestComment2.change_id,
            review_id: createdChangeRequestComment2.review_id,
            content: updatedChangeRequestComment.content
          },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          change_request_id: createdChangeRequest.id,
          user: {
            id: user2.id,
            username: user2.username,
            name: user2.name,
            picture: user2.picture
          },
          action_type: 'ADD_COMMENT',
          action_details: {
            comment_id: createdChangeRequestComment3.id,
            change_id: createdChangeRequestComment3.change_id,
            review_id: createdChangeRequestComment3.review_id,
            content: createdChangeRequestComment3.content
          },
          created_at: expect.any(Date)
        }
      ])
    })
  })
})
