import { ConnectionMock } from '@sort/shared/mocks/connection.mock'
import { OrganizationMock } from '@sort/shared/mocks/org.mock'
import { UserMock } from '@sort/shared/mocks/user.mock'
import * as APIKeyService from '@sort/shared/services/apikey.service'
import * as ConnectionService from '@sort/shared/services/connection.service'
import * as OrganizationService from '@sort/shared/services/org.service'
import * as QueryStorageService from '@sort/shared/services/query/storage.service'
import * as UserService from '@sort/shared/services/user.service'
import * as Utils from '@sort/shared/utils/index'
import { createSchemaImporter } from '@sort/shared/utils/schema-import.util'

import { config } from '../../../config/bootstrap'
import * as KyselyService from '../../../global/services/kysely.service'
import { getTestServer } from '../../../global/utils/test.util'
import { createFastifyMockLogger } from '../../mocks/fastify-logger.mock'
import { SnapshotMock } from '../../mocks/snapshot/snapshot.mock'
import { testInvalidSortAuthHeaders } from '../../utils/test.util'

import type { FastifyInstance } from 'fastify'

const { SORTUI_SERVICE_ACCOUNT_EMAIL } = config

describe('v2/routes/special/home.route', () => {
  const userMock = new UserMock()

  let server: FastifyInstance
  beforeAll(async () => {
    server = await getTestServer()
    KyselyService.createKysely()
  })

  afterAll(async () => {
    await KyselyService.disconnectKysely()
  })

  describe('GET /special/home', () => {
    testInvalidSortAuthHeaders({
      method: 'GET',
      url: '/v2/special/home'
    })

    describe('when accessed by someone other than the sortui service account', () => {
      const rando = userMock.create()
      let userApiKey: Awaited<ReturnType<typeof APIKeyService.createAPIKey>>

      beforeAll(async () => {
        await UserService.createUser(rando)
        userApiKey = await APIKeyService.createAPIKey({ userId: rando.id })
      })

      afterAll(async () => {
        await UserService.removeUserById(rando.id)
      })

      it('returns 401', async () => {
        const response = await server.inject({
          headers: {
            'x-api-key': userApiKey.api_key
          },
          method: 'GET',
          url: '/v2/special/home'
        })

        expect(response.statusCode).toBe(401)
      })
    })

    describe('when accessed by the sortui service account', () => {
      const user = userMock.create()
      const orgMock = new OrganizationMock()
      const publicOrg = orgMock.create({ created_by: user.id })
      const connMock = new ConnectionMock()
      const publicConn = connMock.create({
        organization_id: publicOrg.id,
        created_by: user.id,
        visibility: 'public'
      })
      const privateConn = connMock.create({
        organization_id: publicOrg.id,
        created_by: user.id,
        visibility: 'private'
      })

      const snapshotMock = new SnapshotMock()

      const svcAccount = userMock.create({
        email: SORTUI_SERVICE_ACCOUNT_EMAIL,
        administrator: true
      })
      let userApiKey: Awaited<ReturnType<typeof APIKeyService.createAPIKey>>

      beforeAll(async () => {
        await UserService.createUser(svcAccount, svcAccount.administrator)
        userApiKey = await APIKeyService.createAPIKey({ userId: svcAccount.id })

        await UserService.createUser(user)
        await OrganizationService.create(publicOrg)
        await ConnectionService.create(publicConn)
        await ConnectionService.create(privateConn)

        const log = createFastifyMockLogger()

        snapshotMock.push(
          await createSchemaImporter(publicConn).importSchema(user.id, log)
        )
        snapshotMock.push(
          await createSchemaImporter(privateConn).importSchema(user.id, log)
        )

        const sleep = (ms: number) =>
          new Promise(resolve => setTimeout(resolve, ms))

        // imports can take a while
        await sleep(1000)

        await Promise.all(
          Array.from({ length: 10 }).map((ignore, i) => {
            return sleep(i * 15).then(() =>
              QueryStorageService.insert({
                userId: user.id,
                databaseName: i % 2 === 0 ? 'sort_xyz' : 'postgres',
                connectionId: i % 7 === 0 ? privateConn.id : publicConn.id,
                query: {
                  name: `${i % 7 === 0 ? 'private' : 'public'} query ${i}`,
                  description: `description ${i}`,
                  type: 'intent',
                  intent: {
                    dml: 'SELECT',
                    limit: 100,
                    table: 'connection',
                    orders: [],
                    schema: 'public',
                    columns: ['id', 'organization_id', 'data_provider'],
                    filters: [],
                    combinator: 'AND'
                  }
                }
              })
            )
          })
        )
      }, 10000)

      afterAll(async () => {
        await KyselyService.getDb()
          .deleteFrom('query')
          .where('created_by', 'in', [user.id])
          .execute()
        await snapshotMock.removeAll()
        await connMock.removeAll()
        await KyselyService.getDb()
          .deleteFrom('organization_user')
          .where('user_id', '=', user.id)
          .execute()
        await orgMock.removeAll()
        await userMock.removeAll()
      })

      it('returns 200', async () => {
        const response = await server.inject({
          headers: {
            'x-api-key': userApiKey.api_key
          },
          method: 'GET',
          url: '/v2/special/home'
        })

        const body = response.json()

        expect(body).toEqual({
          type: 'get_home_page_data',
          payload: {
            databases: expect.any(Array),
            queries: expect.any(Array)
          }
        })

        for (let i = 1; i < body.payload.databases.length; i++) {
          const prev = new Date(body.payload.databases[i - 1].updated_at)
          const curr = new Date(body.payload.databases[i].updated_at)
          expect(prev.getTime()).toBeGreaterThanOrEqual(curr.getTime())
        }

        expect(body.payload.databases.length).toBeGreaterThan(0)

        expect(body.payload.databases).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              db_real_name: 'sort_xyz',
              db_summary: '',
              db_slug: expect.stringMatching(/^sort_xyz-/),
              db_display_name: 'sort_xyz',
              connection_id: publicConn.id,
              data_provider: publicConn.data_provider,
              org_slug: publicOrg.slug,
              updated_at: expect.stringMatching(Utils.iso8601RegExp)
            })
          ])
        )

        for (let i = 1; i < body.payload.queries.length; i++) {
          const prev = new Date(body.payload.queries[i - 1].updated_at)
          const curr = new Date(body.payload.queries[i].updated_at)
          expect(prev.getTime()).toBeGreaterThanOrEqual(curr.getTime())
        }

        expect(body.payload.queries.length).toBeGreaterThan(3)
        expect(body.payload.queries).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              query_id: expect.any(String),
              query_name: expect.stringMatching(/^public query/),
              query_description: expect.any(String),
              query_schema: 'public',
              updated_at: expect.stringMatching(Utils.iso8601RegExp),
              connection_id: publicConn.id,
              connection_data_provider: publicConn.data_provider,
              org_slug: publicOrg.slug,
              db_real_name: expect.any(String),
              db_slug: expect.any(String),
              db_display_name: expect.any(String)
            })
          ])
        )

        // all queries must be public
        const connectionIds = body.payload.queries.map(
          (q: { connection_id: string }) => q.connection_id
        )

        const connections = await KyselyService.getDb()
          .selectFrom('connection')
          .where('id', 'in', connectionIds)
          .select(['id', 'visibility'])
          .execute()

        for (const conn of connections) {
          expect(conn).toEqual({ id: conn.id, visibility: 'public' })
        }

        expect(response.statusCode).toBe(200)
      })
    })
  })
})
