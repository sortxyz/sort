import { randomUUID } from 'node:crypto'

import { createKysely, disconnectKysely, getDb } from '..'
import { ChangeRequestMock } from '../mocks/change-requests/change-request.mock'
import { ConnectionMock } from '../mocks/connection.mock'
import { IssueMock } from '../mocks/issue.mock'
import { LabelMock } from '../mocks/label.mock'
import { MetadataDatabaseMock } from '../mocks/metadata.mock'
import { OrganizationMock } from '../mocks/org.mock'
import { UserMock } from '../mocks/user.mock'

import * as ChangeRequestService from './change-requests/change-request.service'
import * as ConnectionService from './connection.service'
import * as DashboardSearchService from './dashboard.search.service'
import * as IssueService from './issue.service'
import * as MetadataDatabaseService from './kysely/metadata/database.service'
import * as LabelService from './label.service'
import * as OrganizationService from './org.service'
import * as UserService from './user.service'

import type { OrganizationMember } from '../schemas/org-member.schema'

describe('Search Dashboard Service Tests', () => {
  const userMock = new UserMock()
  const orgMock = new OrganizationMock()
  const dbMock = new MetadataDatabaseMock()
  const labelMock = new LabelMock()
  const connMock = new ConnectionMock()
  const issueMock = new IssueMock()
  const changeRequestMock = new ChangeRequestMock()

  const user1 = userMock.create()
  const user2 = userMock.create()
  const org1 = orgMock.create({ created_by: user1.id })
  const conn1 = connMock.create({
    organization_id: org1.id,
    created_by: user1.id
  })
  const dbEntry1 = dbMock.create({
    organization_id: org1.id,
    connection_id: conn1.id
  })
  const label1 = labelMock.create({
    connection_id: conn1.id,
    database_name: dbEntry1.raw_name,
    name: 'aloha'
  })
  const label2 = labelMock.create({
    connection_id: conn1.id,
    database_name: dbEntry1.raw_name
  })
  const orgMember = {
    user: {
      id: user1.id,
      username: user1.username,
      name: user1.name,
      picture: user1.picture
    },
    role: {
      id: 1,
      name: 'member'
    }
  } satisfies OrganizationMember

  const issue1 = issueMock.create({
    id: randomUUID(),
    connection_id: dbEntry1.connection_id,
    database_name: dbEntry1.raw_name,
    created_by: user1.id,
    title: 'My Test Issue',
    description: 'This issue has all possible fields defined.',
    labels: [label1, label2],
    assignees: [orgMember]
  })
  const issue2 = issueMock.create({
    id: randomUUID(),
    connection_id: dbEntry1.connection_id,
    database_name: dbEntry1.raw_name,
    created_by: user1.id,
    title: 'my test with no description',
    labels: [label1],
    assignees: [orgMember]
  })
  const issue3 = issueMock.create({
    id: randomUUID(),
    connection_id: dbEntry1.connection_id,
    database_name: dbEntry1.raw_name,
    created_by: user1.id,
    title: 'my closed test issue bonk',
    status: 'closed',
    labels: [],
    assignees: []
  })
  const issue4 = issueMock.create({
    id: randomUUID(),
    connection_id: dbEntry1.connection_id,
    database_name: dbEntry1.raw_name,
    created_by: user1.id,
    title: 'my closed test issue w labels and assignees',
    status: 'closed',
    labels: [label2],
    assignees: [orgMember]
  })
  const changeRequest1 = changeRequestMock.create({
    id: randomUUID(),
    connection_id: dbEntry1.connection_id,
    database_name: dbEntry1.raw_name,
    created_by: user1.id,
    title: 'My Test Change Request',
    description: 'This change request has all possible fields defined.',
    labels: [label1, label2],
    reviewers: [orgMember]
  })
  const changeRequest2 = changeRequestMock.create({
    id: randomUUID(),
    connection_id: dbEntry1.connection_id,
    database_name: dbEntry1.raw_name,
    created_by: user1.id,
    title: 'my test with no description',
    labels: [label1],
    reviewers: [orgMember]
  })
  const changeRequest3 = changeRequestMock.create({
    id: randomUUID(),
    connection_id: dbEntry1.connection_id,
    database_name: dbEntry1.raw_name,
    created_by: user1.id,
    title: 'my closed test change request bonk',
    labels: [],
    reviewers: []
  })
  const changeRequest4 = changeRequestMock.create({
    id: randomUUID(),
    connection_id: dbEntry1.connection_id,
    database_name: dbEntry1.raw_name,
    created_by: user1.id,
    title: 'my closed test change request w labels and reviewers',
    labels: [label2],
    reviewers: [orgMember]
  })
  const changeRequest5 = changeRequestMock.create({
    id: randomUUID(),
    connection_id: dbEntry1.connection_id,
    database_name: dbEntry1.raw_name,
    created_by: user1.id,
    title: 'my applied test change request',
    labels: [],
    reviewers: []
  })
  const changeRequest6 = changeRequestMock.create({
    id: randomUUID(),
    connection_id: dbEntry1.connection_id,
    database_name: dbEntry1.raw_name,
    created_by: user1.id,
    title: 'my executing change request',
    labels: [],
    reviewers: []
  })
  const changeRequest7 = changeRequestMock.create({
    id: randomUUID(),
    connection_id: dbEntry1.connection_id,
    database_name: dbEntry1.raw_name,
    created_by: user1.id,
    title: 'my approved test change request',
    labels: [],
    reviewers: []
  })

  const org2 = orgMock.create({ created_by: user1.id })
  const conn2 = connMock.create({
    organization_id: org2.id,
    created_by: user1.id,
    visibility: 'public'
  })
  const dbEntry2 = dbMock.create({
    organization_id: org2.id,
    connection_id: conn2.id
  })
  const issue1Org2 = issueMock.create({
    id: randomUUID(),
    connection_id: dbEntry2.connection_id,
    database_name: dbEntry2.raw_name,
    created_by: user1.id,
    title: 'My Test Issue in Org2',
    description: 'Org2 issue',
    labels: [],
    assignees: []
  })
  const changeRequest1Org2 = changeRequestMock.create({
    id: randomUUID(),
    connection_id: dbEntry2.connection_id,
    database_name: dbEntry2.raw_name,
    created_by: user1.id,
    title: 'My Test Change Request in Org2',
    description: 'Org2 change request',
    labels: [],
    reviewers: []
  })

  let createdIssue3: Awaited<ReturnType<typeof IssueService.createIssue>>
  let createdIssue4: Awaited<ReturnType<typeof IssueService.createIssue>>

  let createdChangeRequest3: Awaited<
    ReturnType<typeof ChangeRequestService.createChangeRequest>
  >
  let createdChangeRequest4: Awaited<
    ReturnType<typeof ChangeRequestService.createChangeRequest>
  >
  let createdChangeRequest5: Awaited<
    ReturnType<typeof ChangeRequestService.createChangeRequest>
  >
  let createdChangeRequest6: Awaited<
    ReturnType<typeof ChangeRequestService.createChangeRequest>
  >
  let createdChangeRequest7: Awaited<
    ReturnType<typeof ChangeRequestService.createChangeRequest>
  >

  beforeAll(async () => {
    createKysely()

    await UserService.createUser(user1)
    await UserService.createUser(user2)
    await OrganizationService.create(org1)
    await OrganizationService.create(org2)
    await OrganizationService.addMember(org2.slug, user2.id, 'member')
    await ConnectionService.create(conn1)
    await ConnectionService.create(conn2)
    await MetadataDatabaseService.insertMetadataDb(getDb(), dbEntry1)
    await MetadataDatabaseService.insertMetadataDb(getDb(), dbEntry2)
    await LabelService.createDatabaseLabel(label1)
    await LabelService.createDatabaseLabel(label2)

    // make sure issues are created at different times
    await IssueService.createIssue(issue1)
    await new Promise(resolve => setTimeout(resolve, 100))
    await IssueService.createIssue(issue2)
    await new Promise(resolve => setTimeout(resolve, 100))
    createdIssue3 = await IssueService.createIssue(issue3)
    await IssueService.createIssue(issue1Org2)

    await IssueService.updateIssue(
      {
        user_id: user1.id,
        issueData: {
          org_slug: org1.slug,
          connection_id: conn1.id,
          database_name: dbEntry1.raw_name,
          issue_number: createdIssue3.issue_number
        }
      },
      { status: 'closed' }
    )
    createdIssue4 = await IssueService.createIssue(issue4)
    await IssueService.updateIssue(
      {
        user_id: user1.id,
        issueData: {
          org_slug: org1.slug,
          connection_id: conn1.id,
          database_name: dbEntry1.raw_name,
          issue_number: createdIssue4.issue_number
        }
      },
      { status: 'closed' }
    )

    await ChangeRequestService.createChangeRequest(changeRequest1)
    await new Promise(resolve => setTimeout(resolve, 50))
    await ChangeRequestService.createChangeRequest(changeRequest2)
    await new Promise(resolve => setTimeout(resolve, 50))
    createdChangeRequest3 =
      await ChangeRequestService.createChangeRequest(changeRequest3)

    await ChangeRequestService.updateChangeRequest(
      {
        user_id: user1.id,
        changeRequestData: {
          org_slug: org1.slug,
          connection_id: conn1.id,
          database_name: dbEntry1.raw_name,
          change_request_number: createdChangeRequest3.change_request_number
        }
      },
      { status: 'closed' }
    )
    createdChangeRequest3.status = 'closed'

    createdChangeRequest4 =
      await ChangeRequestService.createChangeRequest(changeRequest4)
    await ChangeRequestService.updateChangeRequest(
      {
        user_id: user1.id,
        changeRequestData: {
          org_slug: org1.slug,
          connection_id: conn1.id,
          database_name: dbEntry1.raw_name,
          change_request_number: createdChangeRequest4.change_request_number
        }
      },
      { status: 'closed' }
    )
    createdChangeRequest4.status = 'closed'

    await new Promise(resolve => setTimeout(resolve, 50))
    createdChangeRequest5 =
      await ChangeRequestService.createChangeRequest(changeRequest5)
    await ChangeRequestService.updateChangeRequest(
      {
        user_id: user1.id,
        changeRequestData: {
          org_slug: org1.slug,
          connection_id: conn1.id,
          database_name: dbEntry1.raw_name,
          change_request_number: createdChangeRequest5.change_request_number
        }
      },
      { status: 'applied' }
    )
    createdChangeRequest5.status = 'applied'

    await new Promise(resolve => setTimeout(resolve, 50))
    createdChangeRequest6 =
      await ChangeRequestService.createChangeRequest(changeRequest6)
    await ChangeRequestService.updateChangeRequest(
      {
        user_id: user1.id,
        changeRequestData: {
          org_slug: org1.slug,
          connection_id: conn1.id,
          database_name: dbEntry1.raw_name,
          change_request_number: createdChangeRequest6.change_request_number
        }
      },
      { status: 'executing' }
    )

    createdChangeRequest6.status = 'executing'

    await new Promise(resolve => setTimeout(resolve, 50))
    createdChangeRequest7 =
      await ChangeRequestService.createChangeRequest(changeRequest7)
    await ChangeRequestService.updateChangeRequest(
      {
        user_id: user1.id,
        changeRequestData: {
          org_slug: org1.slug,
          connection_id: conn1.id,
          database_name: dbEntry1.raw_name,
          change_request_number: createdChangeRequest7.change_request_number
        }
      },
      { status: 'approved' }
    )
    createdChangeRequest7.status = 'approved'

    await ChangeRequestService.createChangeRequest(changeRequest1Org2)
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

  describe('#getDashboard', () => {
    it('returns no issues and change requests if connections are private and user is not member', async () => {
      const results = await DashboardSearchService.getDashboard({
        org: org1,
        status: undefined,
        itemType: undefined,
        context: {
          user: user1,
          isCustomerAccount: false,
          isPublicAccount: true
        }
      })

      expect(results).toHaveLength(0)
    })

    it('returns all issues and change requests', async () => {
      const results = await DashboardSearchService.getDashboard({
        org: org1,
        status: undefined,
        itemType: undefined,
        context: {
          user: user1,
          isCustomerAccount: true,
          isPublicAccount: false
        }
      })

      expect(results).toHaveLength(11)
      const ids = new Map()
      for (const item of results) {
        expect(ids.has(item.id)).toBe(false)
        ids.set(item.id, true)
      }
    })

    it('returns no duplicate issues or change requests', async () => {
      const results = await DashboardSearchService.getDashboard({
        org: org2,
        status: undefined,
        itemType: undefined,
        context: {
          user: user1,
          isCustomerAccount: true,
          isPublicAccount: false
        }
      })

      expect(results).toHaveLength(2)
      const ids = new Map()
      for (const item of results) {
        expect(ids.has(item.id)).toBe(false)
        ids.set(item.id, true)
      }
    })

    it('returns all change requests', async () => {
      const results = await DashboardSearchService.getDashboard({
        org: org1,
        status: undefined,
        itemType: 'change_requests',
        context: {
          user: user1,
          isCustomerAccount: true,
          isPublicAccount: false
        }
      })

      expect(results).toHaveLength(7)
      expect(
        results.every(item => item.item_type === 'change_request')
      ).toBeTruthy()
    })

    it('returns all issues', async () => {
      const results = await DashboardSearchService.getDashboard({
        org: org1,
        status: undefined,
        itemType: 'issues',
        context: {
          user: user1,
          isCustomerAccount: true,
          isPublicAccount: false
        }
      })

      expect(results).toHaveLength(4)
      expect(results.every(item => item.item_type === 'issue')).toBeTruthy()
    })

    it('returns all "open" issues and change requests', async () => {
      const results = await DashboardSearchService.getDashboard({
        org: org1,
        status: 'open',
        itemType: undefined,
        context: {
          user: user1,
          isCustomerAccount: true,
          isPublicAccount: false
        }
      })

      expect(results).toHaveLength(6)
      expect(
        results.every(item =>
          ['open', 'approved', 'executing'].includes(item.status)
        )
      ).toBeTruthy()
    })

    it('returns all "closed" issues and change requests', async () => {
      const results = await DashboardSearchService.getDashboard({
        org: org1,
        status: 'closed',
        itemType: undefined,
        context: {
          user: user1,
          isCustomerAccount: true,
          isPublicAccount: false
        }
      })

      expect(results).toHaveLength(5)
      expect(
        results.every(item => ['applied', 'closed'].includes(item.status))
      ).toBeTruthy()
    })

    it('returns all "open" change requests', async () => {
      const results = await DashboardSearchService.getDashboard({
        org: org1,
        status: 'open',
        itemType: 'change_requests',
        context: {
          user: user1,
          isCustomerAccount: true,
          isPublicAccount: false
        }
      })

      expect(results).toHaveLength(4)
      expect(
        results.every(item => item.item_type === 'change_request')
      ).toBeTruthy()
      expect(
        results.every(item =>
          ['open', 'approved', 'executing'].includes(item.status)
        )
      ).toBeTruthy()
    })

    it('returns all "closed" change requests', async () => {
      const results = await DashboardSearchService.getDashboard({
        org: org1,
        status: 'closed',
        itemType: 'change_requests',
        context: {
          user: user1,
          isCustomerAccount: true,
          isPublicAccount: false
        }
      })

      expect(results).toHaveLength(3)
      expect(
        results.every(item => item.item_type === 'change_request')
      ).toBeTruthy()
      expect(
        results.every(item => ['applied', 'closed'].includes(item.status))
      ).toBeTruthy()
    })

    it('returns all "closed" issues', async () => {
      const results = await DashboardSearchService.getDashboard({
        org: org1,
        status: 'closed',
        itemType: 'issues',
        context: {
          user: user1,
          isCustomerAccount: true,
          isPublicAccount: false
        }
      })

      expect(results).toHaveLength(2)
      expect(results.every(item => item.item_type === 'issue')).toBeTruthy()
      expect(
        results.every(item => ['applied', 'closed'].includes(item.status))
      ).toBeTruthy()
    })

    it('returns all "open" issues', async () => {
      const results = await DashboardSearchService.getDashboard({
        org: org1,
        status: 'open',
        itemType: 'issues',
        context: {
          user: user1,
          isCustomerAccount: true,
          isPublicAccount: false
        }
      })

      expect(results).toHaveLength(2)
      expect(results.every(item => item.item_type === 'issue')).toBeTruthy()
      expect(
        results.every(item =>
          ['open', 'approved', 'executing'].includes(item.status)
        )
      ).toBeTruthy()
    })
  })
})
