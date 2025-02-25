import { randomUUID } from 'node:crypto'

import { ConnectionMock } from '@sort/shared/mocks/connection.mock'
import { IssueCommentMock } from '@sort/shared/mocks/issue-comment.mock'
import { IssueMock } from '@sort/shared/mocks/issue.mock'
import { LabelMock } from '@sort/shared/mocks/label.mock'
import { MetadataDatabaseMock } from '@sort/shared/mocks/metadata.mock'
import { OrganizationMock } from '@sort/shared/mocks/org.mock'
import { UserMock } from '@sort/shared/mocks/user.mock'
import * as ConnectionService from '@sort/shared/services/connection.service'
import * as IssueService from '@sort/shared/services/issue.service'
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
import { testInvalidSortAuthHeaders } from '../../../utils/test.util'

import type { OrganizationMember } from '@sort/shared/schemas/org-member.schema'

describe('/v2 issues routes', () => {
  const userMock = new UserMock()
  const orgMock = new OrganizationMock()
  const dbMock = new MetadataDatabaseMock()
  const labelMock = new LabelMock()
  const connMock = new ConnectionMock()
  const issueMock = new IssueMock()
  const issueCommentMock = new IssueCommentMock()

  const user = userMock.create()
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
  const assignee = {
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
  const issue1 = issueMock.create({
    id: randomUUID(),
    connection_id: dbEntry.connection_id,
    database_name: dbEntry.raw_name,
    created_by: user.id,
    title: 'My Test Issue',
    description: 'This issue has all possible fields defined.',
    labels: [label1, label2],
    assignees: [assignee]
  })
  const issue2 = issueMock.create({
    id: randomUUID(),
    connection_id: dbEntry.connection_id,
    database_name: dbEntry.raw_name,
    created_by: user.id,
    title: 'my test issue with no description',
    labels: [label1],
    assignees: []
  })
  const issue3 = issueMock.create({
    id: randomUUID(),
    connection_id: dbEntry.connection_id,
    database_name: dbEntry.raw_name,
    created_by: user.id,
    title: 'my closed test issue',
    status: 'closed',
    labels: [],
    assignees: []
  })

  let server: Awaited<ReturnType<typeof getTestServer>>

  let createdIssue1: Awaited<ReturnType<typeof IssueService.createIssue>>
  let createdIssue2: Awaited<ReturnType<typeof IssueService.createIssue>>
  let createdIssue3: Awaited<ReturnType<typeof IssueService.createIssue>>

  async function setupTests() {
    await UserService.createUser(user)
    await OrganizationService.create(org)
    await ConnectionService.create(conn)
    await MetadataDatabaseService.insertMetadataDb(getDb(), dbEntry)
    await LabelService.createDatabaseLabel(label1)
    await LabelService.createDatabaseLabel(label2)
    createdIssue1 = await IssueService.createIssue(issue1)
    createdIssue2 = await IssueService.createIssue(issue2)
    createdIssue3 = await IssueService.createIssue(issue3)
    await IssueService.updateIssue(
      {
        user_id: user.id,
        issueData: {
          org_slug: org.slug,
          connection_id: conn.id,
          database_name: dbEntry.raw_name,
          issue_number: createdIssue3.issue_number
        }
      },
      { status: 'closed' }
    )
  }

  async function cleanupTests() {
    await issueCommentMock.removeAll()
    await issueMock.removeAll()
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

  afterAll(async () => {
    await cleanupTests()
    await disconnectKysely()
  })

  describe('search_issues operation', () => {
    testInvalidSortAuthHeaders({
      method: 'GET',
      url: '/v2/orgs/some-org-slug/databases/some-db-slug/search/issues'
    })

    it('by default, replies with all open issues', async () => {
      const res = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
        method: 'GET',
        url: `/v2/orgs/${org.slug}/databases/${dbEntry.slug}/search/issues`
      })

      const body = res.json()
      expect(body).toEqual({
        type: 'search_issues',
        payload: {
          issues: expect.arrayContaining([
            expect.objectContaining({
              id: createdIssue1.id,
              connection_id: createdIssue1.connection_id,
              database_name: createdIssue1.database_name,
              status: 'open',
              labels: [label1, label2],
              assignees: [assignee],
              title: createdIssue1.title,
              description: createdIssue1.description,
              created_by: user.id,
              created_at: expect.any(String),
              updated_at: expect.any(String)
            }),
            expect.objectContaining({
              id: createdIssue2.id,
              connection_id: createdIssue2.connection_id,
              database_name: createdIssue2.database_name,
              status: 'open',
              labels: [label1],
              assignees: [],
              title: createdIssue2.title,
              description: createdIssue2.description,
              created_by: user.id,
              created_at: expect.any(String),
              updated_at: expect.any(String)
            })
          ])
        }
      })
      expect(body.payload.issues).toHaveLength(2)
      expect(res.statusCode).toBe(200)
    })

    it('supports text search', async () => {
      const res = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
        method: 'GET',
        url: `/v2/orgs/${org.slug}/databases/${dbEntry.slug}/search/issues?q=description`
      })

      const body = res.json()
      expect(body).toEqual({
        type: 'search_issues',
        payload: {
          issues: expect.arrayContaining([
            expect.objectContaining({
              id: createdIssue2.id,
              connection_id: createdIssue2.connection_id,
              database_name: createdIssue2.database_name,
              status: 'open',
              labels: [label1],
              assignees: [],
              title: createdIssue2.title,
              description: createdIssue2.description,
              created_by: user.id,
              created_at: expect.any(String),
              updated_at: expect.any(String)
            })
          ])
        }
      })
      expect(body.payload.issues).toHaveLength(1)
      expect(res.statusCode).toBe(200)
    })

    it('supports status: scope', async () => {
      const res = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
        method: 'GET',
        url: `/v2/orgs/${org.slug}/databases/${dbEntry.slug}/search/issues?q=status:closed`
      })

      const body = res.json()
      expect(body).toEqual({
        type: 'search_issues',
        payload: {
          issues: expect.arrayContaining([
            expect.objectContaining({
              id: createdIssue3.id,
              connection_id: createdIssue3.connection_id,
              database_name: createdIssue3.database_name,
              status: 'closed',
              labels: [],
              assignees: [],
              title: createdIssue3.title,
              description: createdIssue3.description,
              created_by: user.id,
              created_at: expect.any(String),
              updated_at: expect.any(String)
            })
          ])
        }
      })
      expect(body.payload.issues).toHaveLength(1)
      expect(res.statusCode).toBe(200)
    })

    it('supports limit', async () => {
      const res = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
        method: 'GET',
        url: `/v2/orgs/${org.slug}/databases/${dbEntry.slug}/search/issues?limit=1&q=test`
      })

      const body = res.json()
      expect(body).toEqual({
        type: 'search_issues',
        payload: {
          issues: expect.arrayContaining([
            expect.objectContaining({
              id: createdIssue1.id,
              connection_id: createdIssue1.connection_id,
              database_name: createdIssue1.database_name,
              status: 'open',
              labels: [label1, label2],
              assignees: [assignee],
              title: createdIssue1.title,
              description: createdIssue1.description,
              created_by: user.id,
              created_at: expect.any(String),
              updated_at: expect.any(String)
            })
          ])
        }
      })
      expect(body.payload.issues).toHaveLength(1)
      expect(res.statusCode).toBe(200)
    })
  })
})
