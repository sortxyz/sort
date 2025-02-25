import { ConnectionMock } from '@sort/shared/mocks/connection.mock'
import { OrganizationMock } from '@sort/shared/mocks/org.mock'
import { UserMock } from '@sort/shared/mocks/user.mock'
import * as ConnectionService from '@sort/shared/services/connection.service'
import * as OrganizationService from '@sort/shared/services/org.service'
import * as UserService from '@sort/shared/services/user.service'
import { createSchemaImporter } from '@sort/shared/utils/schema-import.util'

import {
  createKysely,
  disconnectKysely,
  getDb
} from '../../global/services/kysely.service'
import { createFastifyMockLogger } from '../mocks/fastify-logger.mock'
import { SnapshotMock } from '../mocks/snapshot/snapshot.mock'

import * as SearchService from './search.service'

describe('v2/services/search.service', () => {
  const snapshotMock = new SnapshotMock()
  const userMock = new UserMock()
  const user = userMock.create()
  const orgMock = new OrganizationMock()
  const org = orgMock.create({ created_by: user.id })
  const connMock = new ConnectionMock()
  const conn1 = connMock.create({
    organization_id: org.id,
    created_by: user.id
  })
  const conn2 = connMock.create({
    organization_id: org.id,
    created_by: user.id,
    visibility: 'public'
  })

  beforeAll(async () => {
    createKysely()
    await UserService.createUser(user)
    await OrganizationService.create(org)
    await ConnectionService.create(conn1)
    await ConnectionService.create(conn2)

    const log = createFastifyMockLogger()

    const schemaPrivateImporter = createSchemaImporter(conn1)
    snapshotMock.push(await schemaPrivateImporter.importSchema(user.id, log))

    const schemaPublicImporter = createSchemaImporter(conn2)
    snapshotMock.push(await schemaPublicImporter.importSchema(user.id, log))

    // wait for importer to finish
    await new Promise(resolve => setTimeout(resolve, 2500))
  }, 15000)

  afterAll(async () => {
    await snapshotMock.removeAll()
    await connMock.removeAll()
    await getDb()
      .deleteFrom('organization_user')
      .where('user_id', '=', user.id)
      .execute()
    await orgMock.removeAll()
    await userMock.removeAll()
    await disconnectKysely()
  })

  describe('#search', () => {
    describe('with public account', () => {
      it('includes only public results', async () => {
        const results = await SearchService.search({
          query: `"${org.name}" OR sort_xyz OR metadata -nft`,
          context: { user, isCustomerAccount: false, isPublicAccount: true },
          limit: 5
        })

        expect(results).toEqual({
          organizations: [
            {
              org_name: org.name,
              org_slug: org.slug,
              likeness: expect.anything(),
              rank_name: expect.anything()
            }
          ],
          databases: expect.arrayContaining([
            expect.not.objectContaining({
              connection_id: conn1.id,
              connection_name: conn1.name,
              db_name: 'sort_xyz',
              db_name_raw: 'sort_xyz',
              db_slug: expect.stringMatching(/^sort_xyz-/),
              org_name: org.name,
              org_slug: org.slug,
              likeness: expect.anything(),
              rank_name: expect.anything()
            }),
            expect.objectContaining({
              connection_id: conn2.id,
              connection_name: conn2.name,
              db_name: 'sort_xyz',
              db_name_raw: 'sort_xyz',
              db_slug: expect.stringMatching(/^sort_xyz-/),
              org_name: org.name,
              org_slug: org.slug,
              likeness: expect.anything(),
              rank_name: expect.anything()
            })
          ]),
          tables: expect.arrayContaining([
            expect.not.objectContaining({
              connection_id: conn1.id,
              connection_name: conn1.name,
              db_name: 'sort_xyz',
              db_name_raw: 'sort_xyz',
              db_slug: expect.stringMatching(/^sort_xyz-/),
              org_name: org.name,
              org_slug: org.slug,
              rank_name: expect.anything(),
              schema_name: 'public',
              schema_name_raw: 'public',
              likeness: expect.anything(),
              table_name: expect.stringMatching(/^metadata_(table|database)/),
              table_name_raw: expect.stringMatching(
                /^metadata_(table|database)/
              )
            }),
            expect.objectContaining({
              connection_id: conn2.id,
              connection_name: conn2.name,
              db_name: 'sort_xyz',
              db_name_raw: 'sort_xyz',
              db_slug: expect.stringMatching(/^sort_xyz-/),
              org_name: org.name,
              org_slug: org.slug,
              rank_name: expect.anything(),
              schema_name: 'public',
              schema_name_raw: 'public',
              likeness: expect.anything(),
              table_name: expect.stringMatching(/^metadata_(table|database)/),
              table_name_raw: expect.stringMatching(
                /^metadata_(table|database)/
              )
            })
          ])
        })
      })
    })

    describe('with customer account', () => {
      it('includes both public + private results, with private results first', async () => {
        const results = await SearchService.search({
          query: `"${org.name}" OR sort_xyz OR metadata -nft`,
          context: { user, isCustomerAccount: true, isPublicAccount: false },
          limit: 5
        })

        expect(results).toEqual({
          organizations: [
            {
              org_name: org.name,
              org_slug: org.slug,
              likeness: expect.anything(),
              rank_name: expect.anything()
            }
          ],
          databases: expect.arrayContaining([
            expect.objectContaining({
              connection_id: conn1.id,
              connection_name: conn1.name,
              db_name: 'sort_xyz',
              db_name_raw: 'sort_xyz',
              db_slug: expect.stringMatching(/^sort_xyz-/),
              org_name: org.name,
              org_slug: org.slug,
              likeness: expect.anything(),
              rank_name: expect.anything()
            }),
            expect.objectContaining({
              connection_id: conn2.id,
              connection_name: conn2.name,
              db_name: 'sort_xyz',
              db_name_raw: 'sort_xyz',
              db_slug: expect.stringMatching(/^sort_xyz-/),
              org_name: org.name,
              org_slug: org.slug,
              likeness: expect.anything(),
              rank_name: expect.anything()
            })
          ]),
          tables: expect.arrayContaining([
            expect.objectContaining({
              connection_id: conn1.id,
              connection_name: conn1.name,
              db_name: 'sort_xyz',
              db_name_raw: 'sort_xyz',
              db_slug: expect.stringMatching(/^sort_xyz-/),
              org_name: org.name,
              org_slug: org.slug,
              rank_name: expect.anything(),
              schema_name: 'public',
              schema_name_raw: 'public',
              likeness: expect.anything(),
              table_name: expect.stringMatching(/^metadata_(table|database)/),
              table_name_raw: expect.stringMatching(
                /^metadata_(table|database)/
              )
            }),
            expect.objectContaining({
              connection_id: conn2.id,
              connection_name: conn2.name,
              db_name: 'sort_xyz',
              db_name_raw: 'sort_xyz',
              db_slug: expect.stringMatching(/^sort_xyz-/),
              org_name: org.name,
              org_slug: org.slug,
              rank_name: expect.anything(),
              schema_name: 'public',
              schema_name_raw: 'public',
              likeness: expect.anything(),
              table_name: expect.stringMatching(/^metadata_(table|database)/),
              table_name_raw: expect.stringMatching(
                /^metadata_(table|database)/
              )
            })
          ])
        })

        const lastPrivateDbIndex = results.databases.findLastIndex(
          db => db.connection_id === conn1.id
        )
        const firstPublicDbIndex = results.databases.findIndex(
          db => db.connection_id === conn2.id
        )
        expect(firstPublicDbIndex).toBeGreaterThan(lastPrivateDbIndex)

        const lastPrivateTblIndex = results.tables.findLastIndex(
          db => db.connection_id === conn1.id
        )
        const firstPublicTblIndex = results.tables.findIndex(
          db => db.connection_id === conn2.id
        )
        expect(firstPublicTblIndex).toBeGreaterThan(lastPrivateTblIndex)
      })
    })

    describe('scope case', () => {
      it('is insensitive', async () => {
        const name = `${org.name.charAt(0).toUpperCase()}${org.name.slice(1)}`

        const results = await SearchService.search({
          query: `org:"${name}" db:SORT_XYZ schema:Public role`,
          context: { user, isCustomerAccount: true, isPublicAccount: false },
          limit: 1
        })

        expect(results).toEqual({
          organizations: [],
          databases: [],
          tables: [
            {
              connection_id: conn1.id,
              connection_name: conn1.name,
              db_name: 'sort_xyz',
              db_name_raw: 'sort_xyz',
              db_slug: expect.stringMatching(/^sort_xyz-/),
              org_name: org.name,
              org_slug: org.slug,
              rank_name: expect.anything(),
              schema_name: 'public',
              schema_name_raw: 'public',
              likeness: expect.anything(),
              table_name: 'role',
              table_name_raw: 'role'
            }
          ]
        })
      })
    })

    describe('does not throw when invalid utf8 is submitted', () => {
      it('does not throw', async () => {
        const results = await SearchService.search({
          query: '1\x00����%2527%2522',
          context: { user, isCustomerAccount: false, isPublicAccount: true },
          limit: 1
        })

        expect(results).toEqual({
          organizations: [],
          databases: [],
          tables: []
        })
      })
    })
  })

  describe('#parseQuery', () => {
    it('extracts scopes', () => {
      const { phrase, scopes } = SearchService.parseQuery(
        ' z db:\'1\' db :2 schema:f org:x org:"a\' b" schema:\'b "hello" c\' random -other OR thing db:"3" n:0'
      )

      expect(scopes).toEqual({
        db: ['1', '3'],
        org: ['x', "a' b"],
        schema: ['f', 'b "hello" c']
      })

      expect(phrase).toEqual('z  db :2     random -other OR thing  n:0')
    })
  })
})
