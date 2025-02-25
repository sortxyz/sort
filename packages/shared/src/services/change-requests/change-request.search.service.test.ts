import { randomUUID } from 'node:crypto'

import { createKysely, disconnectKysely, getDb } from '../../'
import { ChangeRequestMock } from '../../mocks/change-requests/change-request.mock'
import { ConnectionMock } from '../../mocks/connection.mock'
import { LabelMock } from '../../mocks/label.mock'
import { MetadataDatabaseMock } from '../../mocks/metadata.mock'
import { OrganizationMock } from '../../mocks/org.mock'
import { UserMock } from '../../mocks/user.mock'
import * as ConnectionService from '../connection.service'
import * as MetadataDatabaseService from '../kysely/metadata/database.service'
import * as LabelService from '../label.service'
import * as OrganizationService from '../org.service'
import * as UserService from '../user.service'

import * as ChangeRequestSearchService from './change-request.search.service'
import * as ChangeRequestService from './change-request.service'

import type { OrganizationMember } from '../../schemas/org-member.schema'

describe('ChangeRequestSearchService', () => {
  const userMock = new UserMock()
  const orgMock = new OrganizationMock()
  const dbMock = new MetadataDatabaseMock()
  const labelMock = new LabelMock()
  const connMock = new ConnectionMock()
  const changeRequestMock = new ChangeRequestMock()

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

  const changeRequest1 = changeRequestMock.create({
    id: randomUUID(),
    connection_id: dbEntry.connection_id,
    database_name: dbEntry.raw_name,
    created_by: user.id,
    title: 'My Test Change Request',
    description: 'This change request has all possible fields defined.',
    labels: [label1, label2],
    reviewers: [orgMember]
  })
  const changeRequest2 = changeRequestMock.create({
    id: randomUUID(),
    connection_id: dbEntry.connection_id,
    database_name: dbEntry.raw_name,
    created_by: user.id,
    title: 'my test with no description',
    labels: [label1],
    reviewers: [orgMember]
  })
  const changeRequest3 = changeRequestMock.create({
    id: randomUUID(),
    connection_id: dbEntry.connection_id,
    database_name: dbEntry.raw_name,
    created_by: user.id,
    title: 'my closed test change request bonk',
    labels: [],
    reviewers: []
  })
  const changeRequest4 = changeRequestMock.create({
    id: randomUUID(),
    connection_id: dbEntry.connection_id,
    database_name: dbEntry.raw_name,
    created_by: user.id,
    title: 'my closed test change request w labels and reviewers',
    labels: [label2],
    reviewers: [orgMember]
  })
  const changeRequest5 = changeRequestMock.create({
    id: randomUUID(),
    connection_id: dbEntry.connection_id,
    database_name: dbEntry.raw_name,
    created_by: user.id,
    title: 'my applied test change request',
    labels: [],
    reviewers: []
  })
  const changeRequest6 = changeRequestMock.create({
    id: randomUUID(),
    connection_id: dbEntry.connection_id,
    database_name: dbEntry.raw_name,
    created_by: user.id,
    title: 'my executing change request',
    labels: [],
    reviewers: []
  })
  const changeRequest7 = changeRequestMock.create({
    id: randomUUID(),
    connection_id: dbEntry.connection_id,
    database_name: dbEntry.raw_name,
    created_by: user.id,
    title: 'my approved test change request',
    labels: [],
    reviewers: []
  })

  let createdChangeRequest1: Awaited<
    ReturnType<typeof ChangeRequestService.createChangeRequest>
  >
  let createdChangeRequest2: Awaited<
    ReturnType<typeof ChangeRequestService.createChangeRequest>
  >
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

    await UserService.createUser(user)
    await OrganizationService.create(org)
    await ConnectionService.create(conn)
    await MetadataDatabaseService.insertMetadataDb(getDb(), dbEntry)
    await LabelService.createDatabaseLabel(label1)
    await LabelService.createDatabaseLabel(label2)

    // make sure issues are created at different times so we can test order
    createdChangeRequest1 =
      await ChangeRequestService.createChangeRequest(changeRequest1)
    await new Promise(resolve => setTimeout(resolve, 50))
    createdChangeRequest2 =
      await ChangeRequestService.createChangeRequest(changeRequest2)
    await new Promise(resolve => setTimeout(resolve, 50))
    createdChangeRequest3 =
      await ChangeRequestService.createChangeRequest(changeRequest3)

    await ChangeRequestService.updateChangeRequest(
      {
        user_id: user.id,
        changeRequestData: {
          org_slug: org.slug,
          connection_id: conn.id,
          database_name: dbEntry.raw_name,
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
        user_id: user.id,
        changeRequestData: {
          org_slug: org.slug,
          connection_id: conn.id,
          database_name: dbEntry.raw_name,
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
        user_id: user.id,
        changeRequestData: {
          org_slug: org.slug,
          connection_id: conn.id,
          database_name: dbEntry.raw_name,
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
        user_id: user.id,
        changeRequestData: {
          org_slug: org.slug,
          connection_id: conn.id,
          database_name: dbEntry.raw_name,
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
        user_id: user.id,
        changeRequestData: {
          org_slug: org.slug,
          connection_id: conn.id,
          database_name: dbEntry.raw_name,
          change_request_number: createdChangeRequest7.change_request_number
        }
      },
      { status: 'approved' }
    )
    createdChangeRequest7.status = 'approved'
  })

  afterAll(async () => {
    await changeRequestMock.removeAll()
    await labelMock.removeAll()
    await connMock.removeAll()
    await dbMock.removeAll()
    await orgMock.removeAll(true)
    await userMock.removeAll()

    await disconnectKysely()
  })

  describe('#searchDatabaseChangeRequests', () => {
    it('returns open/approved/executing change requests when no query provided', async () => {
      const results =
        await ChangeRequestSearchService.searchDatabaseChangeRequests({
          orgSlug: org.slug,
          connectionId: conn.id,
          databaseName: dbEntry.raw_name,
          query: '',
          limit: 100
        })

      const statuses = results.map(changeRequest => changeRequest.status)
      expect(statuses).toEqual(['approved', 'executing', 'open', 'open'])

      for (let i = 1; i < results.length; i++) {
        const prev = results[i - 1]
        const curr = results[i]

        expect(prev.created_at.getTime()).toBeGreaterThan(
          curr.created_at.getTime()
        )
      }
    })

    it('returns closed/applied change requests when status:closed provided', async () => {
      const results =
        await ChangeRequestSearchService.searchDatabaseChangeRequests({
          orgSlug: org.slug,
          connectionId: conn.id,
          databaseName: dbEntry.raw_name,
          query: 'status:closed',
          limit: 100
        })

      const statuses = results.map(changeRequest => changeRequest.status)
      expect(statuses).toEqual(['applied', 'closed', 'closed'])

      for (let i = 1; i < results.length; i++) {
        const prev = results[i - 1]
        const curr = results[i]

        expect(prev.created_at.getTime()).toBeGreaterThan(
          curr.created_at.getTime()
        )
      }
    })

    it('supports LIMIT', async () => {
      const results =
        await ChangeRequestSearchService.searchDatabaseChangeRequests({
          orgSlug: org.slug,
          connectionId: conn.id,
          databaseName: dbEntry.raw_name,
          query: 'test',
          limit: 1
        })

      expect(results).toHaveLength(1)
    })

    it('supports query text without scopes', async () => {
      const results =
        await ChangeRequestSearchService.searchDatabaseChangeRequests({
          orgSlug: org.slug,
          connectionId: conn.id,
          databaseName: dbEntry.raw_name,
          query: 'test',
          limit: 100
        })

      expect(results).toHaveLength(3)
    })

    it('supports query text with status scope', async () => {
      const results =
        await ChangeRequestSearchService.searchDatabaseChangeRequests({
          orgSlug: org.slug,
          connectionId: conn.id,
          databaseName: dbEntry.raw_name,
          query: `status:closed ${createdChangeRequest3.title}`,
          limit: 100
        })

      expect(results).toHaveLength(1)
      expect(results[0]).toEqual(
        expect.objectContaining({
          id: createdChangeRequest3.id,
          title: createdChangeRequest3.title,
          status: createdChangeRequest3.status
        })
      )
    })

    it('supports label scope', async () => {
      const results =
        await ChangeRequestSearchService.searchDatabaseChangeRequests({
          orgSlug: org.slug,
          connectionId: conn.id,
          databaseName: dbEntry.raw_name,
          query: `label:'${label2.name}' status:closed label:${label1.name}`,
          limit: 100
        })

      expect(results).toHaveLength(1)
      expect(results[0]).toEqual(
        expect.objectContaining({
          id: createdChangeRequest4.id,
          title: createdChangeRequest4.title,
          status: createdChangeRequest4.status
        })
      )
    })

    it('supports reviewer scope', async () => {
      const results =
        await ChangeRequestSearchService.searchDatabaseChangeRequests({
          orgSlug: org.slug,
          connectionId: conn.id,
          databaseName: dbEntry.raw_name,
          query: `reviewer:${orgMember.user.username} change request`,
          limit: 100
        })

      expect(results).toHaveLength(1)
      expect(results[0]).toEqual(
        expect.objectContaining({
          id: changeRequest1.id
        })
      )
    })

    describe('when no labels or reviewers have been used on any change requests', () => {
      beforeAll(async () => {
        for (const changeRequest of [
          createdChangeRequest1,
          createdChangeRequest2,
          createdChangeRequest3,
          createdChangeRequest4,
          createdChangeRequest5,
          createdChangeRequest6,
          createdChangeRequest7
        ]) {
          await ChangeRequestService.updateChangeRequest(
            {
              user_id: user.id,
              changeRequestData: {
                org_slug: org.slug,
                connection_id: conn.id,
                database_name: dbEntry.raw_name,
                change_request_number: changeRequest.change_request_number
              }
            },
            { reviewers: [], labels: [] }
          )
        }
      })

      it('returns results', async () => {
        const results =
          await ChangeRequestSearchService.searchDatabaseChangeRequests({
            orgSlug: org.slug,
            connectionId: conn.id,
            databaseName: dbEntry.raw_name,
            query: '',
            limit: 100
          })

        const statuses = results.map(changeRequest => changeRequest.status)
        expect(statuses).toEqual(['approved', 'executing', 'open', 'open'])
      })
    })

    describe('does not throw when invalid utf8 is submitted', () => {
      it('does not throw', async () => {
        const results =
          await ChangeRequestSearchService.searchDatabaseChangeRequests({
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
      const res1 = ChangeRequestSearchService.parseQuery(
        // eslint-disable-next-line quotes
        `status:open label:"won't f'ix" label:"" term`
      )
      expect(res1.phrase).toEqual('term')
      expect(res1.scopes).toEqual({
        status: ['open', 'approved', 'executing'],
        label: ["won't f'ix"],
        reviewer: []
      })

      const res2 = ChangeRequestSearchService.parseQuery(
        // eslint-disable-next-line quotes
        `reviewer:super-test status:closed label:'well ""hi"' reviewer:1 term label:'' label:""`
      )
      expect(res2.phrase).toEqual('term')
      expect(res2.scopes).toEqual({
        status: ['closed', 'applied'],
        label: ['well ""hi"'],
        reviewer: ['super-test', '1']
      })

      const res3 = ChangeRequestSearchService.parseQuery('status:applied')
      expect(res3.scopes).toEqual({
        status: ['applied'],
        label: [],
        reviewer: []
      })

      const res4 = ChangeRequestSearchService.parseQuery(
        'status:applied status:executing'
      )
      expect(res4.scopes).toEqual({
        status: ['applied', 'executing'],
        label: [],
        reviewer: []
      })
    })
  })
})
