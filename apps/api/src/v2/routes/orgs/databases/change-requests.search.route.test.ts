import { randomUUID } from 'node:crypto'

import { ChangeRequestCommentMock } from '@sort/shared/mocks/change-requests/change-request-comment.mock'
import { ChangeRequestMock } from '@sort/shared/mocks/change-requests/change-request.mock'
import { ConnectionMock } from '@sort/shared/mocks/connection.mock'
import { LabelMock } from '@sort/shared/mocks/label.mock'
import { MetadataDatabaseMock } from '@sort/shared/mocks/metadata.mock'
import { OrganizationMock } from '@sort/shared/mocks/org.mock'
import { UserMock } from '@sort/shared/mocks/user.mock'
import * as ChangeRequestService from '@sort/shared/services/change-requests/change-request.service'
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
import { testInvalidSortAuthHeaders } from '../../../utils/test.util'

import type { OrganizationMember } from '@sort/shared/schemas/org-member.schema'

describe('/v2 change-requests routes', () => {
  const userMock = new UserMock()
  const orgMock = new OrganizationMock()
  const dbMock = new MetadataDatabaseMock()
  const labelMock = new LabelMock()
  const connMock = new ConnectionMock()
  const changeRequestMock = new ChangeRequestMock()
  const changeRequestCommentMock = new ChangeRequestCommentMock()

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
  const reviewer = {
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
  const changeRequest1 = changeRequestMock.create({
    id: randomUUID(),
    connection_id: dbEntry.connection_id,
    database_name: dbEntry.raw_name,
    created_by: user.id,
    title: 'My Test Change Request',
    description: 'This change request has all possible fields defined.',
    labels: [label1, label2],
    reviewers: [reviewer]
  })
  const changeRequest2 = changeRequestMock.create({
    id: randomUUID(),
    connection_id: dbEntry.connection_id,
    database_name: dbEntry.raw_name,
    created_by: user.id,
    title: 'my test change request with no description',
    labels: [label1],
    reviewers: []
  })
  const changeRequest3 = changeRequestMock.create({
    id: randomUUID(),
    connection_id: dbEntry.connection_id,
    database_name: dbEntry.raw_name,
    created_by: user.id,
    title: 'my closed test change request',
    labels: [],
    reviewers: []
  })

  let server: Awaited<ReturnType<typeof getTestServer>>

  let createdChangeRequest1: Awaited<
    ReturnType<typeof ChangeRequestService.createChangeRequest>
  >
  let createdChangeRequest2: Awaited<
    ReturnType<typeof ChangeRequestService.createChangeRequest>
  >
  let createdChangeRequest3: Awaited<
    ReturnType<typeof ChangeRequestService.createChangeRequest>
  >

  async function setupTests() {
    await UserService.createUser(user)
    await OrganizationService.create(org)
    await ConnectionService.create(conn)
    await MetadataDatabaseService.insertMetadataDb(getDb(), dbEntry)
    await LabelService.createDatabaseLabel(label1)
    await LabelService.createDatabaseLabel(label2)
    createdChangeRequest1 =
      await ChangeRequestService.createChangeRequest(changeRequest1)
    createdChangeRequest2 =
      await ChangeRequestService.createChangeRequest(changeRequest2)
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
  }

  async function cleanupTests() {
    await changeRequestCommentMock.removeAll()
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

  afterAll(async () => {
    await cleanupTests()
    await disconnectKysely()
  })

  describe('searchDatabaseChangeRequests operation', () => {
    testInvalidSortAuthHeaders({
      method: 'GET',
      url: '/v2/orgs/some-org-slug/databases/some-db-slug/search/change-requests'
    })

    it('by default, replies with all open change requests', async () => {
      const res = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
        method: 'GET',
        url: `/v2/orgs/${org.slug}/databases/${dbEntry.slug}/search/change-requests`
      })

      const body = res.json()
      expect(body).toEqual({
        type: 'search_change_requests',
        payload: {
          change_requests: expect.arrayContaining([
            expect.objectContaining({
              id: createdChangeRequest1.id,
              connection_id: createdChangeRequest1.connection_id,
              database_name: createdChangeRequest1.database_name,
              status: 'open',
              labels: [label1, label2],
              reviewers: [reviewer],
              title: createdChangeRequest1.title,
              description: createdChangeRequest1.description,
              created_by: user.id,
              created_at: expect.any(String),
              updated_at: expect.any(String)
            }),
            expect.objectContaining({
              id: createdChangeRequest2.id,
              connection_id: createdChangeRequest2.connection_id,
              database_name: createdChangeRequest2.database_name,
              status: 'open',
              labels: [label1],
              reviewers: [],
              title: createdChangeRequest2.title,
              description: createdChangeRequest2.description,
              created_by: user.id,
              created_at: expect.any(String),
              updated_at: expect.any(String)
            })
          ])
        }
      })
      expect(body.payload.change_requests).toHaveLength(2)
      expect(res.statusCode).toBe(200)
    })

    it('supports text search', async () => {
      const res = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
        method: 'GET',
        url: `/v2/orgs/${org.slug}/databases/${dbEntry.slug}/search/change-requests?q=description`
      })

      const body = res.json()
      expect(body).toEqual({
        type: 'search_change_requests',
        payload: {
          change_requests: expect.arrayContaining([
            expect.objectContaining({
              id: createdChangeRequest2.id,
              connection_id: createdChangeRequest2.connection_id,
              database_name: createdChangeRequest2.database_name,
              status: 'open',
              labels: [label1],
              reviewers: [],
              title: createdChangeRequest2.title,
              description: createdChangeRequest2.description,
              created_by: user.id,
              created_at: expect.any(String),
              updated_at: expect.any(String)
            })
          ])
        }
      })
      expect(body.payload.change_requests).toHaveLength(1)
      expect(res.statusCode).toBe(200)
    })

    it('supports status: scope', async () => {
      const res = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
        method: 'GET',
        url: `/v2/orgs/${org.slug}/databases/${dbEntry.slug}/search/change-requests?q=status:closed`
      })

      const body = res.json()
      expect(body).toEqual({
        type: 'search_change_requests',
        payload: {
          change_requests: expect.arrayContaining([
            expect.objectContaining({
              id: createdChangeRequest3.id,
              connection_id: createdChangeRequest3.connection_id,
              database_name: createdChangeRequest3.database_name,
              status: 'closed',
              labels: [],
              reviewers: [],
              title: createdChangeRequest3.title,
              description: createdChangeRequest3.description,
              created_by: user.id,
              created_at: expect.any(String),
              updated_at: expect.any(String)
            })
          ])
        }
      })
      expect(body.payload.change_requests).toHaveLength(1)
      expect(res.statusCode).toBe(200)
    })

    it('supports limit', async () => {
      const res = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
        method: 'GET',
        url: `/v2/orgs/${org.slug}/databases/${dbEntry.slug}/search/change-requests?limit=1&q=test`
      })

      const body = res.json()
      expect(body).toEqual({
        type: 'search_change_requests',
        payload: {
          change_requests: expect.arrayContaining([
            expect.objectContaining({
              id: createdChangeRequest1.id,
              connection_id: createdChangeRequest1.connection_id,
              database_name: createdChangeRequest1.database_name,
              status: 'open',
              labels: [label1, label2],
              reviewers: [reviewer],
              title: createdChangeRequest1.title,
              description: createdChangeRequest1.description,
              created_by: user.id,
              created_at: expect.any(String),
              updated_at: expect.any(String)
            })
          ])
        }
      })
      expect(body.payload.change_requests).toHaveLength(1)
      expect(res.statusCode).toBe(200)
    })
  })
})
