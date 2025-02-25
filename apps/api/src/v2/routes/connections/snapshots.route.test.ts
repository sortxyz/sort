import { randomUUID } from 'node:crypto'

import { uuidFormat } from '@sort/shared/constants/type-mask.constant'
import {
  ConnectionMock,
  postgresConnectionMock,
  snowflakeConnectionMockPartial
} from '@sort/shared/mocks/connection.mock'
import { MetadataDatabaseMock } from '@sort/shared/mocks/metadata.mock'
import { OrganizationMock } from '@sort/shared/mocks/org.mock'
import { snapshotDatabaseRaw1 } from '@sort/shared/mocks/snapshot/postgres.snapshot.mock'
import { UserMock } from '@sort/shared/mocks/user.mock'
import * as ConnectionService from '@sort/shared/services/connection.service'
import * as OrganizationService from '@sort/shared/services/org.service'
import * as UserService from '@sort/shared/services/user.service'
import { createSchemaImporter } from '@sort/shared/utils/schema-import.util'

import { config } from '../../../config/bootstrap'
import {
  createKysely,
  getDb,
  disconnectKysely
} from '../../../global/services/kysely.service'
import { createServer } from '../../../global/utils/server.util'
import { createFastifyMockLogger } from '../../mocks/fastify-logger.mock'
import { SnapshotMock } from '../../mocks/snapshot/snapshot.mock'
import { getAuthHeaders } from '../../utils/test.util'

import type { ConnectionSelectWithEncryption } from '@sort/shared/types/kysely/connection/connection.type'
import type { FastifyInstance } from 'fastify'

const authTypes = [{ name: 'authorization' }, { name: 'x-api-key' }]

describe('Schema snapshot routes', () => {
  let server: FastifyInstance
  const snapshotMocks = new SnapshotMock()
  const metadataDatabaseMock = new MetadataDatabaseMock()
  const connMock = new ConnectionMock()
  const userMock = new UserMock()
  const orgMock = new OrganizationMock()

  const userMock1 = userMock.create()
  const orgMock1 = orgMock.create({
    created_by: userMock1.id
  })

  const userMock2 = userMock.create()

  const organizationMock2 = orgMock.create({
    slug: 'organization-2',
    name: 'Organization 2',
    created_by: userMock2.id
  })

  let snowflakeConnStr: string
  let snowflakeConnectionMock1: ConnectionSelectWithEncryption
  let snowflakeConnectionMock2: ConnectionSelectWithEncryption
  const pgPrivateConnMock1 = connMock.create({
    ...postgresConnectionMock,
    created_by: userMock1.id,
    organization_id: orgMock1.id
  })
  const pgPublicConnMock1 = connMock.create({
    ...postgresConnectionMock,
    id: randomUUID(),
    name: 'my public connection',
    organization_id: orgMock1.id,
    created_by: userMock1.id,
    visibility: 'public'
  })
  const pgPrivateReadonlyConnMock1 = connMock.create({
    ...postgresConnectionMock,
    id: randomUUID(),
    organization_id: orgMock1.id,
    created_by: userMock1.id
  })
  const pgPrivateParentConnMock1 = connMock.create({
    ...postgresConnectionMock,
    id: randomUUID(),
    organization_id: orgMock1.id,
    readonly_connection_id: pgPrivateReadonlyConnMock1.id,
    created_by: userMock1.id
  })

  beforeAll(async () => {
    createKysely()
    server = await createServer()

    snowflakeConnStr = config.TEST_SNOWFLAKE_HYBRID_CONNECTION_STRING!

    snowflakeConnectionMock1 = connMock.create({
      ...snowflakeConnectionMockPartial,
      connection_string: snowflakeConnStr,
      id: randomUUID(),
      created_by: userMock1.id,
      organization_id: orgMock1.id
    })
    snowflakeConnectionMock2 = connMock.create({
      ...snowflakeConnectionMockPartial,
      connection_string: snowflakeConnStr,
      created_by: userMock2.id,
      organization_id: organizationMock2.id
    })
  })

  beforeEach(async () => {
    await UserService.createUser(userMock1)
    await OrganizationService.create(orgMock1)
    await UserService.createUser(userMock2)
    await OrganizationService.create(organizationMock2)
    await ConnectionService.create(pgPrivateConnMock1)
    await ConnectionService.create(pgPublicConnMock1)
    await ConnectionService.create(snowflakeConnectionMock1)
    await ConnectionService.create(snowflakeConnectionMock2)
    await ConnectionService.create(pgPrivateReadonlyConnMock1)
    await ConnectionService.create(pgPrivateParentConnMock1)
  })

  afterEach(async () => {
    await cleanUp()
  })

  afterAll(async () => {
    await snapshotMocks.removeAll()
    await server.close()
    await disconnectKysely()
  })

  const cleanUp = async () => {
    await connMock.removeAll()

    const userIds = userMock.mocks.map(m => m.id)
    await getDb()
      .deleteFrom('organization_user')
      .where('user_id', 'in', userIds)
      .execute()

    await orgMock.removeAll()
    await userMock.removeAll()

    await metadataDatabaseMock.removeAllByConnectionIds(
      connMock.mocks.map(conn => conn.id)
    )
  }

  describe('createSchemaSnapshot', () => {
    describe.each(authTypes)('using $name auth', ({ name }) => {
      describe('when the organization does not exist', () => {
        it('should respond with HTTP 404', async () => {
          const headers = await getAuthHeaders(name, userMock1.id)

          const response = await server.inject({
            headers,
            method: 'POST',
            url: `/v2/orgs/invalid/connections/${randomUUID()}/schema`
          })

          expect(response.statusCode).toBe(404)
          expect(response.json()).toEqual({
            type: 'error',
            payload: {
              error: {
                message: 'Organization not found.'
              }
            }
          })
        })
      })

      describe('when the organization exists and the user exists but the user does not belong', () => {
        it('should respond with HTTP 404', async () => {
          const headers = await getAuthHeaders(name, userMock2.id)

          const response = await server.inject({
            headers,
            method: 'POST',
            url: `/v2/orgs/${orgMock1.slug}/connections/${randomUUID()}/schema`
          })

          expect(response.statusCode).toBe(404)
          expect(response.json()).toEqual({
            type: 'error',
            payload: {
              error: {
                message: 'Connection not found.'
              }
            }
          })
        })
      })

      describe('when the user belongs to the organization', () => {
        it('should fail to create a snapshot when connection id does not exist', async () => {
          const headers = await getAuthHeaders(name, userMock1.id)

          const response = await server.inject({
            headers,
            method: 'POST',
            url: `/v2/orgs/${orgMock1.slug}/connections/${randomUUID()}/schema`
          })

          expect(response.statusCode).toBe(404)
          expect(response.json()).toEqual({
            type: 'error',
            payload: {
              error: {
                message: 'Connection not found.'
              }
            }
          })
        })

        it('should fail to create a snapshot for a readonly connection', async () => {
          const headers = await getAuthHeaders(name, userMock1.id)

          const response = await server.inject({
            headers,
            method: 'POST',
            url: `/v2/orgs/${orgMock1.slug}/connections/${pgPrivateReadonlyConnMock1.id}/schema`
          })

          expect(response.json()).toEqual({
            type: 'validation_error',
            payload: {
              validation_error: {
                message: 'Connection must not be readonly.',
                context: 'params',
                errors: {
                  params: {
                    connection_id: 'must not be a readonly connection'
                  }
                }
              }
            }
          })
          expect(response.statusCode).toBe(400)
        })

        it('should create/return a snapshot id with the given slug and connection id', async () => {
          const headers = await getAuthHeaders(name, userMock1.id)

          const response = await server.inject({
            headers,
            method: 'POST',
            url: `/v2/orgs/${orgMock1.slug}/connections/${pgPrivateConnMock1.id}/schema`
          })

          expect(response.statusCode).toBe(200)
          expect(response.json()).toEqual({
            type: 'create_schema_snapshot',
            payload: {
              schema_snapshot_id: expect.stringMatching(uuidFormat)
            }
          })
        })
      })
    })
  })

  describe('GET /v2/orgs/:slug/databases', () => {
    describe.each(authTypes)('using $name auth', ({ name }) => {
      describe('when the org does not exist', () => {
        it('responds with HTTP 404', async () => {
          const headers = await getAuthHeaders(name, userMock1.id)

          const response = await server.inject({
            headers,
            method: 'GET',
            url: '/v2/orgs/invalid/databases'
          })

          expect(response.statusCode).toBe(404)
          expect(response.json()).toEqual({
            type: 'error',
            payload: {
              error: {
                message: 'Organization not found.'
              }
            }
          })
        })
      })

      describe('when user belongs to the org', () => {
        it('returns all public and private org databases', async () => {
          const log = createFastifyMockLogger()

          const privateImporter = createSchemaImporter(pgPrivateConnMock1)
          const id1 = await privateImporter.importSchema(userMock1.id, log)
          snapshotMocks.push(id1)

          const publicImporter = createSchemaImporter(pgPublicConnMock1)
          const id2 = await publicImporter.importSchema(userMock1.id, log)
          snapshotMocks.push(id2)

          await getDb()
            .updateTable('metadata_database')
            .set({
              display_name: 'test-2',
              summary: 'test-1'
            })
            .where('raw_name', '=', snapshotDatabaseRaw1.name)
            .where('connection_id', '=', pgPrivateConnMock1.id)
            .execute()

          const headers = await getAuthHeaders(name, userMock1.id)

          const response = await server.inject({
            headers,
            method: 'GET',
            url: `/v2/orgs/${orgMock1.slug}/databases`
          })

          expect(response.statusCode).toBe(200)
          const body = response.json()
          expect(body).toEqual({
            type: 'list_databases',
            payload: {
              databases: expect.arrayContaining([
                expect.objectContaining({
                  connection: pgPrivateConnMock1.name,
                  connection_id: pgPrivateConnMock1.id,
                  organization_id: orgMock1.id,
                  visibility: 'private',
                  data_provider: 'postgres',
                  is_starred: false,
                  summary: 'test-1',
                  display_name: 'test-2',
                  name: 'sort_xyz',
                  slug: expect.stringMatching(/^sort_xyz-/),
                  link: '',
                  schemas: expect.arrayContaining(['public', 'test'])
                }),
                expect.objectContaining({
                  connection: pgPublicConnMock1.name,
                  connection_id: pgPublicConnMock1.id,
                  organization_id: orgMock1.id,
                  visibility: 'public',
                  data_provider: 'postgres',
                  is_starred: false,
                  summary: '',
                  display_name: 'sort_xyz',
                  name: 'sort_xyz',
                  slug: expect.stringMatching(/^sort_xyz-/),
                  link: '',
                  schemas: expect.arrayContaining(['public', 'test'])
                })
              ])
            }
          })
          expect(body.payload.databases.length).toBe(2)
        })
      })

      describe('when user does not belong to the org', () => {
        it('replies with only databases of public connections', async () => {
          const log = createFastifyMockLogger()

          const privateImporter = createSchemaImporter(pgPrivateConnMock1)
          const id1 = await privateImporter.importSchema(userMock1.id, log)
          snapshotMocks.push(id1)

          const publicImporter = createSchemaImporter(pgPublicConnMock1)
          const id2 = await publicImporter.importSchema(userMock1.id, log)
          snapshotMocks.push(id2)

          const headers = await getAuthHeaders(name, userMock2.id)

          const response = await server.inject({
            headers,
            method: 'GET',
            url: `/v2/orgs/${orgMock1.slug}/databases`
          })

          expect(response.statusCode).toBe(200)
          const body = response.json()
          expect(body).toEqual({
            type: 'list_databases',
            payload: {
              databases: expect.arrayContaining([
                expect.objectContaining({
                  connection: pgPublicConnMock1.name,
                  connection_id: pgPublicConnMock1.id,
                  organization_id: orgMock1.id,
                  visibility: 'public',
                  data_provider: 'postgres',
                  is_starred: false,
                  name: 'sort_xyz',
                  slug: expect.stringMatching(/^sort_xyz-/),
                  display_name: 'sort_xyz',
                  link: '',
                  summary: '',
                  schemas: expect.arrayContaining(['public', 'test'])
                })
              ])
            }
          })
          expect(body.payload.databases.length).toBe(1)
        })
      })
    })
  })
})
