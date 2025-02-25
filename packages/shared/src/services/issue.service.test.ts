import { randomUUID } from 'node:crypto'

import { createKysely, disconnectKysely, getDb } from '../'
import { ConnectionMock } from '../mocks/connection.mock'
import { IssueCommentMock } from '../mocks/issue-comment.mock'
import { IssueMock } from '../mocks/issue.mock'
import { LabelMock } from '../mocks/label.mock'
import { MetadataDatabaseMock } from '../mocks/metadata.mock'
import { OrganizationMock } from '../mocks/org.mock'
import { UserMock } from '../mocks/user.mock'
import { sleep } from '../utils/function.util'

import * as ConnectionService from './connection.service'
import * as IssueService from './issue.service'
import * as MetadataDatabaseService from './kysely/metadata/database.service'
import * as LabelService from './label.service'
import * as OrganizationService from './org.service'
import * as UserService from './user.service'

import type { Label } from '../schemas/label.schema'
import type { OrganizationMember } from '../schemas/org-member.schema'

describe('issue.service', () => {
  const userMock = new UserMock()
  const orgMock = new OrganizationMock()
  const dbMock = new MetadataDatabaseMock()
  const labelMock = new LabelMock()
  const connMock = new ConnectionMock()
  const issueMock = new IssueMock()
  const issueCommentMock = new IssueCommentMock()

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
    createKysely()

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
    await issueMock.removeAll()
    await issueCommentMock.removeAll()
  })

  afterAll(async () => {
    await issueMock.removeAll()
    await labelMock.removeAll()
    await connMock.removeAll()
    await dbMock.removeAll()
    await orgMock.removeAll(true)
    await userMock.removeAll()

    await disconnectKysely()
  })

  describe('createIssue', () => {
    it('should create an issue with all fields', async () => {
      const mockIssue = issueMock.create({
        id: randomUUID(),
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Detailed Test Issue',
        description: 'This issue has all possible fields defined.',
        labels: [label1, label2],
        assignees: [orgOwner]
      })

      const createdIssue = await IssueService.createIssue(mockIssue)

      expect(createdIssue).toBeDefined()
      expect(createdIssue.id).toBeDefined()
      expect(createdIssue.metadata_database_connection_id).toBe(
        mockIssue.connection_id
      )
      expect(createdIssue.metadata_database_raw_name).toBe(
        mockIssue.database_name
      )
      expect(createdIssue.created_by).toBe(mockIssue.created_by)
      expect(createdIssue.issue_number).toBe(1)
      expect(createdIssue.title).toBe(mockIssue.title)
      expect(createdIssue.description).toBe(mockIssue.description)
      expect(createdIssue.status).toBe('open')
      expect(createdIssue.created_at).toBeDefined()
      expect(createdIssue.updated_at).toBeDefined()
      expect(createdIssue.labels.length).toBe(2)
      expect(createdIssue.assignees.length).toBe(1)
    })

    it('should create an issue with minimal fields', async () => {
      const mockIssue = issueMock.create({
        id: randomUUID(),
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Minimal Test Issue'
      })

      const createdIssue = await IssueService.createIssue(mockIssue)

      expect(createdIssue).toBeDefined()
      expect(createdIssue.id).toBeDefined()
      expect(createdIssue.metadata_database_connection_id).toBe(
        mockIssue.connection_id
      )
      expect(createdIssue.metadata_database_raw_name).toBe(
        mockIssue.database_name
      )
      expect(createdIssue.created_by).toBe(mockIssue.created_by)
      expect(createdIssue.issue_number).toBe(1)
      expect(createdIssue.title).toBe(mockIssue.title)
      expect(createdIssue.description).toBeNull()
      expect(createdIssue.status).toBe('open')
      expect(createdIssue.created_at).toBeDefined()
      expect(createdIssue.updated_at).toBeDefined()
      expect(createdIssue.labels.length).toBe(0)
      expect(createdIssue.assignees.length).toBe(0)
    })

    it('should auto-increment issue_number starting from 1 within a specific (connection_id, raw_name)', async () => {
      const firstMockIssue = issueMock.create({
        id: randomUUID(),
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'First Issue'
      })

      const secondMockIssue = issueMock.create({
        id: randomUUID(),
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Second Issue'
      })

      const firstIssue = await IssueService.createIssue(firstMockIssue)
      const secondIssue = await IssueService.createIssue(secondMockIssue)

      expect(firstIssue.issue_number).toBe(1)
      expect(secondIssue.issue_number).toBe(2)
    })

    it('should auto-increment issue number starting from 1 for different (connection_id, raw_name)', async () => {
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

      const firstMockIssue = issueMock.create({
        id: randomUUID(),
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'First DB, First Issue'
      })

      const secondMockIssue = issueMock.create({
        id: randomUUID(),
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'First DB, Second Issue'
      })

      const thirdMockIssue = issueMock.create({
        id: randomUUID(),
        connection_id: dbEntry2.connection_id,
        database_name: dbEntry2.raw_name,
        created_by: user.id,
        title: 'Second DB, First Issue'
      })

      const firstIssue = await IssueService.createIssue(firstMockIssue)
      const secondIssue = await IssueService.createIssue(secondMockIssue)
      const thirdIssue = await IssueService.createIssue(thirdMockIssue)

      expect(firstIssue.issue_number).toBe(1)
      expect(secondIssue.issue_number).toBe(2)
      expect(thirdIssue.issue_number).toBe(1)
    })

    it('should default issue.status to "open"', async () => {
      const mockIssue = issueMock.create({
        id: randomUUID(),
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'New Issue'
      })

      const issue = await IssueService.createIssue(mockIssue)

      expect(issue.status).toBe('open')
    })

    it('should emit CREATE_ISSUE events on issue creation', async () => {
      const mockIssue = issueMock.create({
        id: randomUUID(),
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'New Issue'
      })

      const createdIssue = await IssueService.createIssue(mockIssue)

      const events = await getDb()
        .selectFrom('issue_history')
        .selectAll()
        .where('issue_id', '=', mockIssue.id)
        .execute()

      // expect(events).toHaveLength(2)
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        issue_id: createdIssue.id,
        user_id: createdIssue.created_by,
        action_type: 'CREATE_ISSUE',
        action_details: { issue_number: 1 }
      })
    })

    it('should reject non-existent metadata database', async () => {
      const nonExistentConnectionId = randomUUID()

      const mockIssue = issueMock.create({
        id: randomUUID(),
        connection_id: nonExistentConnectionId,
        database_name: 'non-existent-db-name',
        created_by: user.id,
        title: 'Issue with non-existent Metadata Database'
      })

      try {
        await IssueService.createIssue(mockIssue)
        fail('Expected issue creation to fail with non-existent connection')
      } catch (error) {
        if (!(error instanceof Error)) {
          fail('Caught error is not of type Error')
        }

        if (!(error.cause && error.cause instanceof Error)) {
          fail('Caught error cause is not of type Error')
        }

        expect(error.message).toBe('Failed to create issue')
        expect(error.cause.message).toContain(
          'violates foreign key constraint "fk_issue_metadata_database"'
        )
      }
    })

    it('should reject non-existent user in created_by', async () => {
      const nonExistentUserId = randomUUID()

      const mockIssue = issueMock.create({
        id: randomUUID(),
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: nonExistentUserId,
        title: 'Issue with non-existent created_by User'
      })

      try {
        await IssueService.createIssue(mockIssue)
        fail('Expected issue creation to fail with non-existent user')
      } catch (error) {
        if (!(error instanceof Error)) {
          fail('Caught error is not of type Error')
        }

        if (!(error.cause && error.cause instanceof Error)) {
          fail('Caught error cause is not of type Error')
        }

        expect(error.message).toBe('Failed to create issue')
        expect(error.cause.message).toContain(
          'violates foreign key constraint "fk_issue_created_by"'
        )
      }
    })

    it('should reject titles exceeding 256 character length', async () => {
      const longTitle = 'a'.repeat(257)

      const mockIssue = issueMock.create({
        id: randomUUID(),
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: longTitle
      })

      try {
        await IssueService.createIssue(mockIssue)
        fail('Expected issue creation to fail with long title')
      } catch (error) {
        if (!(error instanceof Error)) {
          fail('Caught error is not of type Error')
        }

        if (!(error.cause && error.cause instanceof Error)) {
          fail('Caught error cause is not of type Error')
        }

        expect(error.message).toBe('Failed to create issue')
        expect(error.cause.message).toContain(
          'value too long for type character varying(256)'
        )
      }
    })

    it('should reject duplicate labels', async () => {
      const mockIssue = issueMock.create({
        id: randomUUID(),
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Issue with duplicate labels',
        labels: [label1, label1]
      })

      try {
        await IssueService.createIssue(mockIssue)
        fail('Expected issue creation to fail with duplicate labels')
      } catch (error) {
        if (!(error instanceof Error)) {
          fail('Caught error is not of type Error')
        }

        if (!(error.cause && error.cause instanceof Error)) {
          fail('Caught error cause is not of type Error')
        }

        expect(error.message).toBe('Failed to create issue')
        expect(error.cause.message).toContain(
          'duplicate key value violates unique constraint "issue_label_pkey"'
        )
      }
    })

    it('should reject duplicate assignees', async () => {
      const mockIssue = issueMock.create({
        id: randomUUID(),
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Issue with duplicate assignees',
        assignees: [orgOwner, orgOwner]
      })

      try {
        await IssueService.createIssue(mockIssue)
        fail('Expected issue creation to fail with duplicate assignees')
      } catch (error) {
        if (!(error instanceof Error)) {
          fail('Caught error is not of type Error')
        }

        if (!(error.cause && error.cause instanceof Error)) {
          fail('Caught error cause is not of type Error')
        }

        expect(error.message).toBe('Failed to create issue')
        expect(error.cause.message).toContain(
          'duplicate key value violates unique constraint "issue_assignee_pkey"'
        )
      }
    })

    it('should enforce user permissions for issue creation', async () => {
      // TODO: Auth is handled by the controller.
      //       Implement this in the route tests instead?
    })

    it('should handles concurrent issue creation requests', async () => {
      // TODO: Implement this
    })

    it('should reject non-existent labels', async () => {
      // TODO: Implement this
    })

    it('should reject custom labels not associated with this database', async () => {
      // TODO: Implement this
    })

    it('should reject non-existent assignees', async () => {
      // TODO: Implement this
    })

    it('should reject non-org-member assignees', async () => {
      // TODO: Implement this
    })
  })

  describe('getIssue', () => {
    it('should return null if no issues are found w/ the criteria', async () => {
      const issue = await IssueService.getIssue({
        org_slug: org.slug,
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        issue_number: 100
      })

      expect(issue).toBeNull()
    })
  })

  describe('getDatabaseIssues', () => {
    it('should return an empty array if no issues are found', async () => {
      const issues = await IssueService.getDatabaseIssues({
        org_slug: org.slug,
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name
      })

      expect(issues).toBeDefined()
      expect(issues).toHaveLength(0)
    })

    it('should return issues with labels and assignees', async () => {
      const mockIssue = issueMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Issue',
        labels: [label1, label2],
        assignees: [orgOwner]
      })

      await IssueService.createIssue(mockIssue)

      const issues = await IssueService.getDatabaseIssues({
        org_slug: org.slug,
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name
      })

      expect(issues).toBeDefined()
      expect(issues).toHaveLength(1)
      expect(issues[0].labels).toHaveLength(2)
      expect(issues[0].assignees).toHaveLength(1)
    })

    it('should handle issues with no labels or assignees', async () => {
      const mockIssue = issueMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Issue'
      })

      await IssueService.createIssue(mockIssue)

      const issues = await IssueService.getDatabaseIssues({
        org_slug: org.slug,
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name
      })

      expect(issues).toBeDefined()
      expect(issues).toHaveLength(1)
      expect(issues[0].labels).toHaveLength(0)
      expect(issues[0].assignees).toHaveLength(0)
    })

    it('should return only the first 100 issues', async () => {
      for (let i = 0; 102 > i; i++) {
        const mockIssue = issueMock.create({
          connection_id: dbEntry.connection_id,
          database_name: dbEntry.raw_name,
          created_by: user.id,
          title: `Test Issue ${Math.random()}`
        })

        await IssueService.createIssue(mockIssue)
      }

      const issues = await IssueService.getDatabaseIssues({
        org_slug: org.slug,
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name
      })

      expect(issues).toBeDefined()
      expect(issues).toHaveLength(100)
    })
  })

  describe('createIssueComment', () => {
    it('should reject non-existent issue', async () => {
      const nonExistentIssueId = randomUUID()

      try {
        await IssueService.createIssueComment(
          {
            org_slug: org.slug,
            issue_id: nonExistentIssueId
          },
          {
            id: randomUUID(),
            created_by: user.id,
            content: 'This is a test comment for a non-existent issue.'
          }
        )
        fail('Expected issue comment creation to fail with non-existent issue')
      } catch (error) {
        if (!(error instanceof Error)) {
          fail('Caught error is not of type Error')
        }

        if (!(error.cause && error.cause instanceof Error)) {
          fail('Caught error cause is not of type Error')
        }

        expect(error.message).toBe('Issue does not exist')
        expect(error.cause.message).toContain(
          'violates foreign key constraint "fk_issue_comment_issue_id"'
        )
      }
    })
  })

  describe('deleteIssueComment', () => {
    it('should successfully delete an issue comment', async () => {
      const mockIssue = issueMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Issue'
      })

      const createdIssue = await IssueService.createIssue(mockIssue)

      const mockComment = issueCommentMock.create({
        issue_id: createdIssue.id,
        created_by: user.id
      })

      const createdComment = await IssueService.createIssueComment(
        {
          org_slug: org.slug,
          issue_id: createdIssue.id
        },
        mockComment
      )

      await IssueService.deleteIssueComment({
        id: createdComment.id,
        userId: user.id,
        issue_id: createdIssue.id
      })

      const remainingIssueComment = await IssueService.getIssueComment(
        createdIssue.id
      )

      expect(remainingIssueComment).toBeUndefined()
    })
  })

  describe('getIssueTimeline', () => {
    it('should return timeline events for issue creation without an initial description', async () => {
      const mockIssue = issueMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Issue'
      })

      const createdIssue = await IssueService.createIssue(mockIssue)

      const timeline = await IssueService.getIssueTimeline(createdIssue.id)

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(1)
      expect(timeline).toEqual([
        {
          id: expect.any(String),
          issue_id: createdIssue.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'CREATE_ISSUE',
          action_details: { issue_number: 1 },
          created_at: expect.any(Date)
        }
      ])
    })

    // NOTE: We do not currently emit an ADD_DESCRIPTION event on issue creation
    it('should return timeline events for issue creation with an initial description', async () => {
      const mockIssue = issueMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Issue',
        description: 'This is a test issue.'
      })

      const createdIssue = await IssueService.createIssue(mockIssue)

      const timeline = await IssueService.getIssueTimeline(createdIssue.id)

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(1)
      expect(timeline).toEqual([
        {
          id: expect.any(String),
          issue_id: createdIssue.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'CREATE_ISSUE',
          action_details: { issue_number: 1 },
          created_at: expect.any(Date)
        }
      ])
    })

    it('should return timeline events for issue creation with initial labels', async () => {
      const mockIssue = issueMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Issue',
        description: 'This is a test issue.',
        labels: [label1, label2, label3]
      })

      const createdIssue = await IssueService.createIssue(mockIssue)

      const timeline = await IssueService.getIssueTimeline(createdIssue.id)

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(4)
      expect(timeline.map(event => event.action_type)).toEqual([
        'CREATE_ISSUE',
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

    it('should return timeline events for issue creation with initial assignees', async () => {
      const mockIssue = issueMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Issue',
        description: 'This is a test issue.',
        assignees: [orgOwner, orgMember2, orgMember3]
      })

      const createdIssue = await IssueService.createIssue(mockIssue)

      const timeline = await IssueService.getIssueTimeline(createdIssue.id)

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(4)
      expect(timeline.map(event => event.action_type)).toEqual([
        'CREATE_ISSUE',
        'ADD_ASSIGNEE',
        'ADD_ASSIGNEE',
        'ADD_ASSIGNEE'
      ])
      expect(
        timeline
          .filter(event => event.action_type === 'ADD_ASSIGNEE')
          .map(event => event.action_details.assignee)
      ).toEqual(expect.arrayContaining([orgOwner, orgMember2, orgMember3]))
    })

    it('should return timeline events for title updates', async () => {
      const mockIssue = issueMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Issue'
      })

      const createdIssue = await IssueService.createIssue(mockIssue)

      const where = {
        user_id: user.id,
        issueData: {
          org_slug: org.slug,
          connection_id: dbEntry.connection_id,
          database_name: dbEntry.raw_name,
          issue_number: createdIssue.issue_number
        }
      }

      await IssueService.updateIssue(where, { title: 'Updated Test Issue' })

      const timeline = await IssueService.getIssueTimeline(createdIssue.id)

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(2)
      expect(timeline).toEqual([
        {
          id: expect.any(String),
          issue_id: createdIssue.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'CREATE_ISSUE',
          action_details: { issue_number: 1 },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          issue_id: createdIssue.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'UPDATE_TITLE',
          action_details: { curr: 'Updated Test Issue', prev: 'Test Issue' },
          created_at: expect.any(Date)
        }
      ])
    })

    it('should return timeline events for description updates', async () => {
      const mockIssue = issueMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Issue',
        description: 'This is a test issue.'
      })

      const createdIssue = await IssueService.createIssue(mockIssue)

      const where = {
        user_id: user.id,
        issueData: {
          org_slug: org.slug,
          connection_id: dbEntry.connection_id,
          database_name: dbEntry.raw_name,
          issue_number: createdIssue.issue_number
        }
      }

      await IssueService.updateIssue(where, {
        description: 'This is an updated test issue.'
      })

      const timeline = await IssueService.getIssueTimeline(createdIssue.id)

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(2)
      expect(timeline).toEqual([
        {
          id: expect.any(String),
          issue_id: createdIssue.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'CREATE_ISSUE',
          action_details: { issue_number: 1 },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          issue_id: createdIssue.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'UPDATE_DESCRIPTION',
          action_details: {
            curr: 'This is an updated test issue.',
            prev: 'This is a test issue.'
          },
          created_at: expect.any(Date)
        }
      ])
    })

    it('should return timeline events for status updates', async () => {
      const mockIssue = issueMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Issue',
        description: 'This is a test issue.'
      })

      const createdIssue = await IssueService.createIssue(mockIssue)

      const where = {
        user_id: user.id,
        issueData: {
          org_slug: org.slug,
          connection_id: dbEntry.connection_id,
          database_name: dbEntry.raw_name,
          issue_number: createdIssue.issue_number
        }
      }

      await IssueService.updateIssue(where, { status: 'closed' })
      await IssueService.updateIssue(where, { status: 'open' })
      await IssueService.updateIssue(where, { status: 'closed' })

      const timeline = await IssueService.getIssueTimeline(createdIssue.id)

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(4)
      expect(timeline).toEqual([
        {
          id: expect.any(String),
          issue_id: createdIssue.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'CREATE_ISSUE',
          action_details: { issue_number: 1 },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          issue_id: createdIssue.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'CLOSE_ISSUE',
          action_details: { issue_number: 1 },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          issue_id: createdIssue.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'REOPEN_ISSUE',
          action_details: { issue_number: 1 },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          issue_id: createdIssue.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'CLOSE_ISSUE',
          action_details: { issue_number: 1 },
          created_at: expect.any(Date)
        }
      ])
    })

    it('should return timeline events for label additions', async () => {
      const mockIssue = issueMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Issue',
        description: 'This is a test issue.'
      })

      const createdIssue = await IssueService.createIssue(mockIssue)

      const where = {
        user_id: user.id,
        issueData: {
          org_slug: org.slug,
          connection_id: dbEntry.connection_id,
          database_name: dbEntry.raw_name,
          issue_number: createdIssue.issue_number
        }
      }

      await IssueService.updateIssue(where, { labels: [label1] })

      const timeline = await IssueService.getIssueTimeline(createdIssue.id)

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(2)
      expect(timeline).toEqual([
        {
          id: expect.any(String),
          issue_id: createdIssue.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'CREATE_ISSUE',
          action_details: { issue_number: 1 },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          issue_id: createdIssue.id,
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
      const mockIssue = issueMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Issue',
        description: 'This is a test issue.'
      })

      const createdIssue = await IssueService.createIssue(mockIssue)

      const where = {
        user_id: user.id,
        issueData: {
          org_slug: org.slug,
          connection_id: dbEntry.connection_id,
          database_name: dbEntry.raw_name,
          issue_number: createdIssue.issue_number
        }
      }

      await IssueService.updateIssue(where, { labels: [label1] })
      await IssueService.updateIssue(where, {
        labels: [label1, label2, label3]
      })

      const timeline = await IssueService.getIssueTimeline(createdIssue.id)

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(4)
      expect(timeline.map(event => event.action_type)).toEqual([
        'CREATE_ISSUE',
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
      const mockIssue = issueMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Issue',
        description: 'This is a test issue.'
      })

      const createdIssue = await IssueService.createIssue(mockIssue)

      const where = {
        user_id: user.id,
        issueData: {
          org_slug: org.slug,
          connection_id: dbEntry.connection_id,
          database_name: dbEntry.raw_name,
          issue_number: createdIssue.issue_number
        }
      }

      await IssueService.updateIssue(where, { labels: [label1] })
      await IssueService.updateIssue(where, { labels: [] })

      const timeline = await IssueService.getIssueTimeline(createdIssue.id)

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(3)
      expect(timeline).toEqual([
        {
          id: expect.any(String),
          issue_id: createdIssue.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'CREATE_ISSUE',
          action_details: { issue_number: 1 },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          issue_id: createdIssue.id,
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
          issue_id: createdIssue.id,
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

    it('should return timeline events for assignee additions', async () => {
      const mockIssue = issueMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Issue',
        description: 'This is a test issue.'
      })

      const createdIssue = await IssueService.createIssue(mockIssue)

      const where = {
        user_id: user.id,
        issueData: {
          org_slug: org.slug,
          connection_id: dbEntry.connection_id,
          database_name: dbEntry.raw_name,
          issue_number: createdIssue.issue_number
        }
      }

      await IssueService.updateIssue(where, { assignees: [orgOwner] })

      const timeline = await IssueService.getIssueTimeline(createdIssue.id)

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(2)
      expect(timeline).toEqual([
        {
          id: expect.any(String),
          issue_id: createdIssue.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'CREATE_ISSUE',
          action_details: { issue_number: 1 },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          issue_id: createdIssue.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'ADD_ASSIGNEE',
          action_details: { assignee: orgOwner },
          created_at: expect.any(Date)
        }
      ])
    })

    it('should return timeline events for multiple assignee additions', async () => {
      const mockIssue = issueMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Issue',
        description: 'This is a test issue.'
      })

      const createdIssue = await IssueService.createIssue(mockIssue)

      const where = {
        user_id: user.id,
        issueData: {
          org_slug: org.slug,
          connection_id: dbEntry.connection_id,
          database_name: dbEntry.raw_name,
          issue_number: createdIssue.issue_number
        }
      }

      await IssueService.updateIssue(where, { assignees: [orgOwner] })
      await IssueService.updateIssue(where, {
        assignees: [orgOwner, orgMember2, orgMember3]
      })

      const timeline = await IssueService.getIssueTimeline(createdIssue.id)

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(4)
      expect(timeline.map(event => event.action_type)).toEqual([
        'CREATE_ISSUE',
        'ADD_ASSIGNEE',
        'ADD_ASSIGNEE',
        'ADD_ASSIGNEE'
      ])
      expect(
        timeline
          .filter(event => event.action_type === 'ADD_ASSIGNEE')
          .map(event => event.action_details.assignee)
      ).toEqual(expect.arrayContaining([orgOwner, orgMember2, orgMember3]))
    })

    it('should return timeline events for assignee removals', async () => {
      const mockIssue = issueMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Issue',
        description: 'This is a test issue.'
      })

      const createdIssue = await IssueService.createIssue(mockIssue)

      const where = {
        user_id: user.id,
        issueData: {
          org_slug: org.slug,
          connection_id: dbEntry.connection_id,
          database_name: dbEntry.raw_name,
          issue_number: createdIssue.issue_number
        }
      }

      await IssueService.updateIssue(where, { assignees: [orgOwner] })
      await IssueService.updateIssue(where, { assignees: [] })

      const timeline = await IssueService.getIssueTimeline(createdIssue.id)

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(3)
      expect(timeline).toEqual([
        {
          id: expect.any(String),
          issue_id: createdIssue.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'CREATE_ISSUE',
          action_details: { issue_number: 1 },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          issue_id: createdIssue.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'ADD_ASSIGNEE',
          action_details: { assignee: orgOwner },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          issue_id: createdIssue.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'REMOVE_ASSIGNEE',
          action_details: { assignee: orgOwner },
          created_at: expect.any(Date)
        }
      ])
    })

    it('should return timeline events for comment additions', async () => {
      const mockIssue = issueMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Issue',
        description: 'This is a test issue.'
      })

      const mockIssueComment = issueCommentMock.create({
        issue_id: mockIssue.id,
        created_by: user.id,
        content: 'This is a test comment.'
      })

      const createdIssue = await IssueService.createIssue(mockIssue)

      const createdIssueComment = await IssueService.createIssueComment(
        { org_slug: org.slug, issue_id: createdIssue.id },
        mockIssueComment
      )

      const timeline = await IssueService.getIssueTimeline(createdIssue.id)

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(2)
      expect(timeline).toEqual([
        {
          id: expect.any(String),
          issue_id: createdIssue.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'CREATE_ISSUE',
          action_details: { issue_number: 1 },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          issue_id: createdIssue.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'ADD_COMMENT',
          action_details: {
            comment_id: createdIssueComment.id,
            content: createdIssueComment.content
          },
          created_at: expect.any(Date)
        }
      ])
    })

    it('should return timeline events for multiple comment additions', async () => {
      const mockIssue = issueMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Issue',
        description: 'This is a test issue.'
      })

      const mockIssueComment1 = issueCommentMock.create({
        issue_id: mockIssue.id,
        created_by: user.id,
        content: 'This is a test comment.'
      })

      const mockIssueComment2 = issueCommentMock.create({
        issue_id: mockIssue.id,
        created_by: user.id,
        content: 'This is another test comment.'
      })

      const createdIssue = await IssueService.createIssue(mockIssue)

      const createdIssueComment1 = await IssueService.createIssueComment(
        { org_slug: org.slug, issue_id: createdIssue.id },
        mockIssueComment1
      )

      const createdIssueComment2 = await IssueService.createIssueComment(
        { org_slug: org.slug, issue_id: createdIssue.id },
        mockIssueComment2
      )

      const timeline = await IssueService.getIssueTimeline(createdIssue.id)

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(3)
      expect(timeline).toEqual([
        {
          id: expect.any(String),
          issue_id: createdIssue.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'CREATE_ISSUE',
          action_details: { issue_number: 1 },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          issue_id: createdIssue.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'ADD_COMMENT',
          action_details: {
            comment_id: createdIssueComment1.id,
            content: createdIssueComment1.content
          },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          issue_id: createdIssue.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'ADD_COMMENT',
          action_details: {
            comment_id: createdIssueComment2.id,
            content: createdIssueComment2.content
          },
          created_at: expect.any(Date)
        }
      ])
    })

    it('should return timeline events for comment updates', async () => {
      const mockIssue = issueMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Issue',
        description: 'This is a test issue.'
      })

      const mockIssueComment = issueCommentMock.create({
        issue_id: mockIssue.id,
        created_by: user.id,
        content: 'This is a test comment.'
      })

      const createdIssue = await IssueService.createIssue(mockIssue)

      const createdIssueComment = await IssueService.createIssueComment(
        { org_slug: org.slug, issue_id: createdIssue.id },
        mockIssueComment
      )

      const updatedIssueComment = await IssueService.updateIssueComment({
        id: createdIssueComment.id,
        issue_id: createdIssue.id,
        content: 'This is a test comment, edited.'
      })

      const timeline = await IssueService.getIssueTimeline(createdIssue.id)

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(2)
      expect(timeline).toEqual([
        {
          id: expect.any(String),
          issue_id: createdIssue.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'CREATE_ISSUE',
          action_details: { issue_number: 1 },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          issue_id: createdIssue.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'UPDATE_COMMENT',
          action_details: {
            comment_id: createdIssueComment.id,
            content: updatedIssueComment.content
          },
          created_at: expect.any(Date)
        }
      ])
    })

    it('should filter out timeline events for comment deletions', async () => {
      const mockIssue = issueMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Issue',
        description: 'This is a test issue.'
      })

      const mockIssueComment = issueCommentMock.create({
        issue_id: mockIssue.id,
        created_by: user.id,
        content: 'This is a test comment.'
      })

      const createdIssue = await IssueService.createIssue(mockIssue)

      const createdIssueComment = await IssueService.createIssueComment(
        { org_slug: org.slug, issue_id: createdIssue.id },
        mockIssueComment
      )

      await IssueService.deleteIssueComment({
        id: createdIssueComment.id,
        userId: user.id,
        issue_id: createdIssue.id
      })

      const timeline = await IssueService.getIssueTimeline(createdIssue.id)

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(1)
      expect(timeline).toEqual([
        {
          id: expect.any(String),
          issue_id: createdIssue.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'CREATE_ISSUE',
          action_details: { issue_number: 1 },
          created_at: expect.any(Date)
        }
      ])
    })

    it('should return issue timeline for an issue with a complicated issue history', async () => {
      const mockIssue = issueMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Issue',
        labels: [label1]
      })

      // Event 1, 2: CREATE_ISSUE, ADD_LABEL
      const createdIssue = await IssueService.createIssue(mockIssue)

      const where = {
        user_id: user.id,
        issueData: {
          org_slug: org.slug,
          connection_id: dbEntry.connection_id,
          database_name: dbEntry.raw_name,
          issue_number: createdIssue.issue_number
        }
      }

      // Event 3: REMOVE_LABEL
      await IssueService.updateIssue(where, { labels: [] })
      // Event 4: ADD_ASSIGNEE
      await IssueService.updateIssue(where, { assignees: [orgOwner] })

      // Event 5: REMOVE_ASSIGNEE
      await IssueService.updateIssue(where, { assignees: [] })

      // Event 6, 7, 8: ADD_LABEL, ADD_LABEL, ADD_LABEL
      await IssueService.updateIssue(where, {
        labels: [label1, label2, label3]
      })

      // Event 9, 10: REMOVE_LABEL, REMOVE_LABEL
      await IssueService.updateIssue(where, { labels: [label1] })

      // Event 11: ADD_ASSIGNEE
      await IssueService.updateIssue(where, { assignees: [orgOwner] })

      // Event 12: UPDATE_TITLE
      await IssueService.updateIssue(where, { title: 'Updated Test Issue' })

      // Event 12b: UPDATE_DESCRIPTION
      await IssueService.updateIssue(where, {
        description: 'Updated description'
      })

      const comment1Id = randomUUID()
      const comment2Id = randomUUID()
      const comment3Id = randomUUID()

      await IssueService.createIssueComment(
        { org_slug: org.slug, issue_id: createdIssue.id },
        {
          id: comment1Id,
          created_by: user.id,
          content: 'First comment.'
        }
      )
      // Event 13: UPDATE_COMMENT
      await IssueService.updateIssueComment({
        id: comment1Id,
        issue_id: createdIssue.id,
        content: 'First comment, edited.'
      })

      await IssueService.createIssueComment(
        { org_slug: org.slug, issue_id: createdIssue.id },
        {
          id: comment2Id,
          created_by: user.id,
          content: 'Second comment.'
        }
      )
      await IssueService.updateIssueComment({
        id: comment2Id,
        issue_id: createdIssue.id,
        content: 'Second comment, edited.'
      })

      await IssueService.createIssueComment(
        { org_slug: org.slug, issue_id: createdIssue.id },
        {
          id: comment3Id,
          created_by: user.id,
          content: 'Third comment.'
        }
      )
      await IssueService.updateIssueComment({
        id: comment3Id,
        issue_id: createdIssue.id,
        content: 'Third comment, first edit.'
      })

      // Event 14: UPDATE_COMMENT
      await IssueService.updateIssueComment({
        id: comment3Id,
        issue_id: createdIssue.id,
        content: 'Third comment, second edit.'
      })

      await IssueService.deleteIssueComment({
        id: comment2Id,
        userId: user.id,
        issue_id: createdIssue.id
      })

      const timeline = await IssueService.getIssueTimeline(createdIssue.id)

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(15)
      expect(timeline.map(event => event.action_type)).toEqual([
        'CREATE_ISSUE',
        'ADD_LABEL',
        'REMOVE_LABEL',
        'ADD_ASSIGNEE',
        'REMOVE_ASSIGNEE',
        'ADD_LABEL',
        'ADD_LABEL',
        'ADD_LABEL',
        'REMOVE_LABEL',
        'REMOVE_LABEL',
        'ADD_ASSIGNEE',
        'UPDATE_TITLE',
        'UPDATE_DESCRIPTION',
        'UPDATE_COMMENT',
        'UPDATE_COMMENT'
      ])
    })

    it('should return issue timeline with an updated label, post-label update', async () => {
      const mockIssue = issueMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Issue',
        labels: [label1]
      })

      const createdIssue = await IssueService.createIssue(mockIssue)

      const where = {
        user_id: user.id,
        issueData: {
          org_slug: org.slug,
          connection_id: dbEntry.connection_id,
          database_name: dbEntry.raw_name,
          issue_number: createdIssue.issue_number
        }
      }

      await IssueService.updateIssue(where, {
        labels: [label2]
      })

      const timelinePreUpdate = await IssueService.getIssueTimeline(
        createdIssue.id
      )

      expect(timelinePreUpdate).toBeDefined()
      expect(timelinePreUpdate).toHaveLength(4)
      expect(timelinePreUpdate.map(event => event.action_type).sort()).toEqual(
        ['CREATE_ISSUE', 'ADD_LABEL', 'ADD_LABEL', 'REMOVE_LABEL'].sort()
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

      await IssueService.updateIssue(where, { labels: [] })

      const timelinePostUpdate = await IssueService.getIssueTimeline(
        createdIssue.id
      )

      expect(timelinePostUpdate).toBeDefined()
      expect(timelinePostUpdate).toHaveLength(5)
      expect(timelinePostUpdate.map(event => event.action_type).sort()).toEqual(
        [
          'CREATE_ISSUE',
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
      const mockIssue = issueMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test Issue',
        description: 'This is a test issue.'
      })

      const mockIssueComment = issueCommentMock.create({
        issue_id: mockIssue.id,
        created_by: user.id,
        content: 'This is the first comment.'
      })

      const mockIssueComment2 = issueCommentMock.create({
        issue_id: mockIssue.id,
        created_by: user2.id,
        content: 'This is the second comment.'
      })

      const mockIssueComment3 = issueCommentMock.create({
        issue_id: mockIssue.id,
        created_by: user2.id,
        content: 'This is the third comment.'
      })

      const createdIssue = await IssueService.createIssue(mockIssue)

      const createdIssueComment1 = await IssueService.createIssueComment(
        { org_slug: org.slug, issue_id: createdIssue.id },
        mockIssueComment
      )

      await sleep(1)
      const createdIssueComment2 = await IssueService.createIssueComment(
        { org_slug: org.slug, issue_id: createdIssue.id },
        mockIssueComment2
      )

      await sleep(1)
      const createdIssueComment3 = await IssueService.createIssueComment(
        { org_slug: org.slug, issue_id: createdIssue.id },
        mockIssueComment3
      )

      const preTimeline = await IssueService.getIssueTimeline(createdIssue.id)

      expect(preTimeline).toHaveLength(4)
      expect(preTimeline).toEqual([
        {
          id: expect.any(String),
          issue_id: createdIssue.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'CREATE_ISSUE',
          action_details: { issue_number: 1 },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          issue_id: createdIssue.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'ADD_COMMENT',
          action_details: {
            comment_id: createdIssueComment1.id,
            content: createdIssueComment1.content
          },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          issue_id: createdIssue.id,
          user: {
            id: user2.id,
            username: user2.username,
            name: user2.name,
            picture: user2.picture
          },
          action_type: 'ADD_COMMENT',
          action_details: {
            comment_id: createdIssueComment2.id,
            content: createdIssueComment2.content
          },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          issue_id: createdIssue.id,
          user: {
            id: user2.id,
            username: user2.username,
            name: user2.name,
            picture: user2.picture
          },
          action_type: 'ADD_COMMENT',
          action_details: {
            comment_id: createdIssueComment3.id,
            content: createdIssueComment3.content
          },
          created_at: expect.any(Date)
        }
      ])

      const updatedIssueComment = await IssueService.updateIssueComment({
        id: createdIssueComment2.id,
        issue_id: createdIssue.id,
        content: 'This is the second comment, edited.'
      })

      expect(updatedIssueComment).toBeDefined()

      const timeline = await IssueService.getIssueTimeline(createdIssue.id)

      expect(timeline).toBeDefined()
      expect(timeline).toHaveLength(4)
      expect(timeline).toEqual([
        {
          id: expect.any(String),
          issue_id: createdIssue.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'CREATE_ISSUE',
          action_details: { issue_number: 1 },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          issue_id: createdIssue.id,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            picture: user.picture
          },
          action_type: 'ADD_COMMENT',
          action_details: {
            comment_id: createdIssueComment1.id,
            content: createdIssueComment1.content
          },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          issue_id: createdIssue.id,
          user: {
            id: user2.id,
            username: user2.username,
            name: user2.name,
            picture: user2.picture
          },
          action_type: 'UPDATE_COMMENT',
          action_details: {
            comment_id: createdIssueComment2.id,
            content: updatedIssueComment.content
          },
          created_at: expect.any(Date)
        },
        {
          id: expect.any(String),
          issue_id: createdIssue.id,
          user: {
            id: user2.id,
            username: user2.username,
            name: user2.name,
            picture: user2.picture
          },
          action_type: 'ADD_COMMENT',
          action_details: {
            comment_id: createdIssueComment3.id,
            content: createdIssueComment3.content
          },
          created_at: expect.any(Date)
        }
      ])
    })
  })
})
