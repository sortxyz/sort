import { randomUUID } from 'node:crypto'

import { createKysely, disconnectKysely, getDb } from '../'
import { ConnectionMock } from '../mocks/connection.mock'
import { IssueMock } from '../mocks/issue.mock'
import { LabelMock } from '../mocks/label.mock'
import { MetadataDatabaseMock } from '../mocks/metadata.mock'
import { OrganizationMock } from '../mocks/org.mock'
import { UserMock } from '../mocks/user.mock'

import * as ConnectionService from './connection.service'
import * as IssueSearchService from './issue.search.service'
import * as IssueService from './issue.service'
import * as MetadataDatabaseService from './kysely/metadata/database.service'
import * as LabelService from './label.service'
import * as OrganizationService from './org.service'
import * as UserService from './user.service'

import type { OrganizationMember } from '../schemas/org-member.schema'

describe('IssueSearchService', () => {
  const userMock = new UserMock()
  const orgMock = new OrganizationMock()
  const dbMock = new MetadataDatabaseMock()
  const labelMock = new LabelMock()
  const connMock = new ConnectionMock()
  const issueMock = new IssueMock()

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
    database_name: dbEntry.raw_name,
    name: 'aloha'
  })
  const label2 = labelMock.create({
    connection_id: conn.id,
    database_name: dbEntry.raw_name
  })
  const orgMember = {
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      picture: user.picture
    },
    role: {
      id: 1,
      name: 'member'
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
    assignees: [orgMember]
  })
  const issue2 = issueMock.create({
    id: randomUUID(),
    connection_id: dbEntry.connection_id,
    database_name: dbEntry.raw_name,
    created_by: user.id,
    title: 'my test with no description',
    labels: [label1],
    assignees: [orgMember]
  })
  const issue3 = issueMock.create({
    id: randomUUID(),
    connection_id: dbEntry.connection_id,
    database_name: dbEntry.raw_name,
    created_by: user.id,
    title: 'my closed test issue bonk',
    status: 'closed',
    labels: [],
    assignees: []
  })
  const issue4 = issueMock.create({
    id: randomUUID(),
    connection_id: dbEntry.connection_id,
    database_name: dbEntry.raw_name,
    created_by: user.id,
    title: 'my closed test issue w labels and assignees',
    status: 'closed',
    labels: [label2],
    assignees: [orgMember]
  })

  let createdIssue1: Awaited<ReturnType<typeof IssueService.createIssue>>
  let createdIssue2: Awaited<ReturnType<typeof IssueService.createIssue>>
  let createdIssue3: Awaited<ReturnType<typeof IssueService.createIssue>>
  let createdIssue4: Awaited<ReturnType<typeof IssueService.createIssue>>

  beforeAll(async () => {
    createKysely()

    await UserService.createUser(user)
    await OrganizationService.create(org)
    await ConnectionService.create(conn)
    await MetadataDatabaseService.insertMetadataDb(getDb(), dbEntry)
    await LabelService.createDatabaseLabel(label1)
    await LabelService.createDatabaseLabel(label2)

    // make sure issues are created at different times
    createdIssue1 = await IssueService.createIssue(issue1)
    await new Promise(resolve => setTimeout(resolve, 100))
    createdIssue2 = await IssueService.createIssue(issue2)
    await new Promise(resolve => setTimeout(resolve, 100))
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
    createdIssue4 = await IssueService.createIssue(issue4)
    await IssueService.updateIssue(
      {
        user_id: user.id,
        issueData: {
          org_slug: org.slug,
          connection_id: conn.id,
          database_name: dbEntry.raw_name,
          issue_number: createdIssue4.issue_number
        }
      },
      { status: 'closed' }
    )
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

  describe('#searchDatabaseIssues', () => {
    it('returns all open issues when no query provided', async () => {
      const results = await IssueSearchService.searchDatabaseIssues({
        orgSlug: org.slug,
        connectionId: conn.id,
        databaseName: dbEntry.raw_name,
        query: '',
        limit: 100
      })

      const statuses = results.map(issue => issue.status)
      expect(statuses).toEqual(['open', 'open'])

      expect(results[0].created_at.getTime()).toBeGreaterThan(
        results[1].created_at.getTime()
      )
    })

    it('supports LIMIT', async () => {
      const results = await IssueSearchService.searchDatabaseIssues({
        orgSlug: org.slug,
        connectionId: conn.id,
        databaseName: dbEntry.raw_name,
        query: 'test',
        limit: 1
      })

      expect(results).toHaveLength(1)
    })

    it('supports query text without scopes', async () => {
      const results = await IssueSearchService.searchDatabaseIssues({
        orgSlug: org.slug,
        connectionId: conn.id,
        databaseName: dbEntry.raw_name,
        query: 'test',
        limit: 100
      })

      expect(results).toHaveLength(2)
    })

    it('supports query text with status scope', async () => {
      const results = await IssueSearchService.searchDatabaseIssues({
        orgSlug: org.slug,
        connectionId: conn.id,
        databaseName: dbEntry.raw_name,
        query: `status:closed ${issue3.title}`,
        limit: 100
      })

      expect(results).toHaveLength(1)
      expect(results[0]).toEqual(
        expect.objectContaining({
          id: issue3.id,
          title: issue3.title,
          status: issue3.status
        })
      )
    })

    it('supports label scope', async () => {
      const results = await IssueSearchService.searchDatabaseIssues({
        orgSlug: org.slug,
        connectionId: conn.id,
        databaseName: dbEntry.raw_name,
        query: `label:'${label2.name}' status:closed label:${label1.name}`,
        limit: 100
      })

      expect(results).toHaveLength(1)
      expect(results[0]).toEqual(
        expect.objectContaining({
          id: issue4.id,
          title: issue4.title,
          status: issue4.status
        })
      )
    })

    it('supports assignee scope', async () => {
      const results = await IssueSearchService.searchDatabaseIssues({
        orgSlug: org.slug,
        connectionId: conn.id,
        databaseName: dbEntry.raw_name,
        query: `assignee:${orgMember.user.username} issue`,
        limit: 100
      })

      expect(results).toHaveLength(1)
      expect(results[0]).toEqual(
        expect.objectContaining({
          id: issue1.id
        })
      )
    })

    describe('when no labels or assignees have been used on any issues', () => {
      beforeAll(async () => {
        for (const issue of [
          createdIssue1,
          createdIssue2,
          createdIssue3,
          createdIssue4
        ]) {
          await IssueService.updateIssue(
            {
              user_id: user.id,
              issueData: {
                org_slug: org.slug,
                connection_id: conn.id,
                database_name: dbEntry.raw_name,
                issue_number: issue.issue_number
              }
            },
            { assignees: [], labels: [] }
          )
        }
      })

      it('returns results', async () => {
        const results = await IssueSearchService.searchDatabaseIssues({
          orgSlug: org.slug,
          connectionId: conn.id,
          databaseName: dbEntry.raw_name,
          query: '',
          limit: 100
        })

        const statuses = results.map(issue => issue.status)
        expect(statuses).toEqual(['open', 'open'])
      })
    })

    describe('does not throw when invalid utf8 is submitted', () => {
      it('does not throw', async () => {
        const results = await IssueSearchService.searchDatabaseIssues({
          orgSlug: org.slug,
          connectionId: conn.id,
          databaseName: dbEntry.raw_name,
          query: '1\x00����%2527%2522',
          limit: 1
        })

        expect(results).toEqual([])
      })
    })
  })

  describe('#parseQuery', () => {
    it('works', async () => {
      const res1 = IssueSearchService.parseQuery(
        // eslint-disable-next-line quotes
        `status:open label:"won't f'ix" label:"" term`
      )
      expect(res1.phrase).toEqual('term')
      expect(res1.scopes).toEqual({
        status: ['open'],
        label: ["won't f'ix"],
        assignee: []
      })

      const res2 = IssueSearchService.parseQuery(
        // eslint-disable-next-line quotes
        `assignee:super-test status:open label:'well ""hi"' assignee:1 term label:'' label:""`
      )
      expect(res2.phrase).toEqual('term')
      expect(res2.scopes).toEqual({
        status: ['open'],
        label: ['well ""hi"'],
        assignee: ['super-test', '1']
      })
    })
  })
})
