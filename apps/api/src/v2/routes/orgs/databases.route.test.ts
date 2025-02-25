import { randomUUID } from 'node:crypto'

import { createKysely, disconnectKysely } from '@sort/shared'
import { uuidFormat } from '@sort/shared/constants/type-mask.constant'
import { ConnectionMock } from '@sort/shared/mocks/connection.mock'
import { OrganizationMock } from '@sort/shared/mocks/org.mock'
import { UserMock } from '@sort/shared/mocks/user.mock'
import * as ConnectionService from '@sort/shared/services/connection.service'
import { getColumnsByTableId } from '@sort/shared/services/kysely/snapshot/column.service'
import { getTableFromCurrentSnapshot } from '@sort/shared/services/kysely/snapshot/table.service'
import * as OrganizationService from '@sort/shared/services/org.service'
import { getColumnTypeMapper } from '@sort/shared/services/query/column-type.util'
import * as UserService from '@sort/shared/services/user.service'
import * as Utils from '@sort/shared/utils/index'
import { createSchemaImporter } from '@sort/shared/utils/schema-import.util'

import { config, logger } from '../../../config/bootstrap'
import * as KyselyService from '../../../global/services/kysely.service'
import { getTestServer } from '../../../global/utils/test.util'
import { createFastifyMockLogger } from '../../mocks/fastify-logger.mock'
import { SnapshotMock } from '../../mocks/snapshot/snapshot.mock'
import { createSortJwt } from '../../utils/jwt.util'
import { testInvalidSortAuthHeaders, getDbSlug } from '../../utils/test.util'

import type { SortDB } from '@sort/shared/types/kysely.type'

const publicTables = [
  'change',
  'change_field_value',
  'change_primary_key',
  'change_request',
  'change_request_action_type',
  'change_request_comment',
  'change_request_history',
  'change_request_issue',
  'change_request_job',
  'change_request_label',
  'change_request_reviewer',
  'connection',
  'default_label',
  'issue',
  'issue_action_type',
  'issue_assignee',
  'issue_comment',
  'issue_history',
  'issue_label',
  'job_status',
  'label',
  'metadata_database',
  'metadata_table',
  'organization',
  'organization_invite',
  'organization_user',
  'query',
  'query_type',
  'review',
  'review_event_type',
  'role',
  'schema_job',
  'snapshot',
  'snapshot_column',
  'snapshot_database',
  'snapshot_schema',
  'snapshot_table',
  'snapshot_column',
  'user',
  'user_api_key'
]

describe('/v2 databases routes', () => {
  const userMock = new UserMock()
  const user1 = userMock.create()
  const user2 = userMock.create()
  const user3 = userMock.create()
  const orgMock = new OrganizationMock()
  const org1 = orgMock.create({ created_by: user1.id })
  const org2 = orgMock.create({ created_by: user2.id })
  const connMock = new ConnectionMock()
  const conn1 = connMock.create({
    organization_id: org1.id,
    created_by: user1.id
  })
  const conn2 = connMock.create({
    organization_id: org1.id,
    created_by: user1.id
  })
  const conn3 = connMock.create({
    organization_id: org1.id,
    created_by: user1.id,
    visibility: 'public'
  })
  const snapshotMock = new SnapshotMock()
  let snapshotMock3Id: string = ''
  let server: Awaited<ReturnType<typeof getTestServer>>
  let mockPrivateDbs: SortDB['metadata_database'][]
  let mockPublicDbs: SortDB['metadata_database'][]

  async function cleanupTests() {
    await connMock.removeAll()

    await KyselyService.getDb()
      .deleteFrom('organization_user')
      .where(
        'user_id',
        'in',
        userMock.mocks.map(m => m.id)
      )
      .execute()

    await orgMock.removeAll()
    await userMock.removeAll()
    await snapshotMock.removeAll()
  }

  async function setupTests() {
    await UserService.createUser(user1)
    await UserService.createUser(user2)
    await UserService.createUser(user3)
    await OrganizationService.create(org1)
    await OrganizationService.addMember(org1.slug, user3.id, 'member')
    await OrganizationService.create(org2)
    await ConnectionService.create(conn1)
    await ConnectionService.create(conn2)
    await ConnectionService.create(conn3)

    const schemaImporter1 = createSchemaImporter(conn1)
    const log = createFastifyMockLogger()
    snapshotMock.push(await schemaImporter1.importSchema(user1.id, log))

    const schemaImporter2 = createSchemaImporter(conn2)
    snapshotMock.push(await schemaImporter2.importSchema(user1.id, log))

    const schemaImporter3 = createSchemaImporter(conn3)
    snapshotMock3Id = await schemaImporter3.importSchema(user1.id, log)
    snapshotMock.push(snapshotMock3Id)

    mockPrivateDbs = await KyselyService.getDb()
      .selectFrom('metadata_database')
      .innerJoin(
        'connection',
        'metadata_database.connection_id',
        'connection.id'
      )
      .where('connection.organization_id', '=', org1.id)
      .where('connection.visibility', '=', 'private')
      .selectAll('metadata_database')
      .execute()

    mockPublicDbs = await KyselyService.getDb()
      .selectFrom('metadata_database')
      .innerJoin(
        'connection',
        'metadata_database.connection_id',
        'connection.id'
      )
      .where('connection.organization_id', '=', org1.id)
      .where('connection.visibility', '=', 'public')
      .selectAll('metadata_database')
      .execute()
  }

  beforeAll(async () => {
    server = await getTestServer()

    KyselyService.createKysely()
    createKysely({ config, sortLogger: logger })

    await setupTests()
  }, 10000)

  afterAll(async () => {
    await cleanupTests()
    await KyselyService.disconnectKysely()
    await disconnectKysely()
  })

  const expectSchema = ({
    schemaName,
    tables,
    columns
  }: {
    schemaName: string
    tables?: boolean
    columns?: boolean
  }) => {
    if (columns && !tables) {
      throw new Error('Cannot expect columns without tables.')
    }

    if (tables) {
      return expect.objectContaining({
        name: schemaName,
        id: expect.stringMatching(uuidFormat),
        tables: expect.arrayContaining([expectTable({ columns })])
      })
    } else {
      return expect.objectContaining({
        name: schemaName,
        id: expect.stringMatching(uuidFormat)
      })
    }
  }

  const expectTable = ({
    tableName,
    columns = false
  }: {
    tableName?: string
    columns?: boolean
  }) => {
    if (columns) {
      return expect.objectContaining({
        name: tableName || expect.any(String),
        id: expect.stringMatching(uuidFormat),
        columns: expect.arrayContaining([expectColumn()])
      })
    } else {
      return expect.objectContaining({
        name: tableName || expect.any(String),
        id: expect.stringMatching(uuidFormat)
      })
    }
  }

  const expectColumn = (colName?: string) => {
    return expect.objectContaining({
      name: colName || expect.any(String),
      type: expect.any(String),
      nullable: expect.any(Boolean),
      is_primary_key: colName === 'id' ? true : expect.any(Boolean),
      has_default: expect.any(Boolean)
    })
  }

  describe('getDatabase operation', () => {
    testInvalidSortAuthHeaders({
      method: 'GET',
      url: '/v2/orgs/some-org-slug/databases/some-db-slug'
    })

    describe('when the organization does not exist', () => {
      it('returns a 404', async () => {
        const response = await server.inject({
          headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
          method: 'GET',
          url: `/v2/orgs/asdNOPEf9adsfyh/databases/${mockPrivateDbs[0].slug}`
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

    describe('when the user belongs to the org', () => {
      describe('when the database does not exist', () => {
        it('returns a 404', async () => {
          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
            method: 'GET',
            url: `/v2/orgs/${org1.slug}/databases/kajsdkasnoasdkas`
          })

          expect(response.statusCode).toBe(404)

          expect(response.json()).toEqual({
            type: 'error',
            payload: {
              error: {
                message: 'Database not found.'
              }
            }
          })
        })
      })
    })

    describe('when connection.visibility is private', () => {
      describe('when the user does not belong to the org', () => {
        it('replies with 404', async () => {
          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(user2.id)}` },
            method: 'GET',
            url: `/v2/orgs/${org1.slug}/databases/${mockPrivateDbs[0].slug}`
          })

          expect(response.statusCode).toBe(404)

          expect(response.json()).toEqual({
            type: 'error',
            payload: {
              error: {
                message: 'Database not found.'
              }
            }
          })
        })
      })

      describe('when the user belongs to the org', () => {
        it('replies with the database', async () => {
          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
            method: 'GET',
            url: `/v2/orgs/${org1.slug}/databases/${mockPrivateDbs[0].slug}`
          })

          expect(response.statusCode).toBe(200)

          expect(response.json()).toEqual({
            type: 'get_database',
            payload: {
              database: expect.objectContaining({
                ...mockPrivateDbs[0],
                connection_id: conn1.id,
                slug: expect.any(String),
                summary: ''
              })
            }
          })
        })
      })
    })

    describe('when connection.visibility is public', () => {
      describe('when the user does not belong to the org', () => {
        it('replies with the database', async () => {
          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(user2.id)}` },
            method: 'GET',
            url: `/v2/orgs/${org1.slug}/databases/${mockPublicDbs[0].slug}`
          })

          expect(response.statusCode).toBe(200)

          expect(response.json()).toEqual({
            type: 'get_database',
            payload: {
              database: expect.objectContaining({
                ...mockPublicDbs[0],
                connection_id: conn3.id,
                slug: expect.any(String),
                summary: ''
              })
            }
          })
        })
      })
    })
  })

  describe('get_database_connection operation', () => {
    testInvalidSortAuthHeaders({
      method: 'GET',
      url: '/v2/orgs/some-org-slug/databases/some-db-slug/connection'
    })

    describe('when the organization does not exist', () => {
      it('returns a 404', async () => {
        const response = await server.inject({
          headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
          method: 'GET',
          url: `/v2/orgs/asdNOPEf9adsfyh/databases/${mockPrivateDbs[0].slug}/connection`
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

    describe('when the user belongs to the org', () => {
      describe('when the database does not exist', () => {
        it('returns a 404', async () => {
          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
            method: 'GET',
            url: `/v2/orgs/${org1.slug}/databases/kajsdkasnoasdkas/connection`
          })

          expect(response.statusCode).toBe(404)

          expect(response.json()).toEqual({
            type: 'error',
            payload: {
              error: {
                message: 'Database not found.'
              }
            }
          })
        })
      })
    })

    describe('when connection.visibility is private', () => {
      describe('when the user does not belong to the org', () => {
        it('replies with 404', async () => {
          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(user2.id)}` },
            method: 'GET',
            url: `/v2/orgs/${org1.slug}/databases/${mockPrivateDbs[0].slug}/connection`
          })

          expect(response.statusCode).toBe(404)

          expect(response.json()).toEqual({
            type: 'error',
            payload: {
              error: {
                message: 'Database not found.'
              }
            }
          })
        })
      })

      describe('when the user belongs to the org', () => {
        it('replies with the connection', async () => {
          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
            method: 'GET',
            url: `/v2/orgs/${org1.slug}/databases/${mockPrivateDbs[0].slug}/connection`
          })

          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { connection_string: ignored, ...conn } = conn1

          expect(response.json()).toEqual({
            type: 'get_database_connection',
            payload: {
              connection: expect.objectContaining({
                ...conn,
                created_at: expect.stringMatching(Utils.iso8601RegExp)
              })
            }
          })

          expect(response.statusCode).toBe(200)
        })
      })
    })

    describe('when connection.visibility is public', () => {
      describe('when the user does not belong to the org', () => {
        it('replies with the connection', async () => {
          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(user2.id)}` },
            method: 'GET',
            url: `/v2/orgs/${org1.slug}/databases/${mockPublicDbs[0].slug}/connection`
          })

          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { connection_string: ignored, ...conn } = conn3

          expect(response.json()).toEqual({
            type: 'get_database_connection',
            payload: {
              connection: expect.objectContaining({
                ...conn,
                created_at: expect.stringMatching(Utils.iso8601RegExp)
              })
            }
          })

          expect(response.statusCode).toBe(200)
        })
      })
    })
  })

  describe('update_database operation', () => {
    testInvalidSortAuthHeaders({
      method: 'PATCH',
      url: '/v2/orgs/some-org-slug/databases/some-db-slug'
    })

    describe('when the organization does not exist', () => {
      it('returns a 404', async () => {
        const response = await server.inject({
          headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
          method: 'PATCH',
          url: `/v2/orgs/asdNOPEf9adsfyh/databases/${mockPrivateDbs[0].slug}`,
          payload: {
            slug: 'new-slug'
          }
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

    describe('when the user does not belong to the org', () => {
      it('returns a 404', async () => {
        const response = await server.inject({
          headers: { authorization: `Bearer ${createSortJwt(user2.id)}` },
          method: 'PATCH',
          url: `/v2/orgs/${org1.slug}/databases/${mockPrivateDbs[0].slug}`,
          payload: {
            slug: 'new-slug'
          }
        })

        expect(response.statusCode).toBe(404)

        expect(response.json()).toEqual({
          type: 'error',
          payload: {
            error: {
              message: 'Database not found.'
            }
          }
        })
      })
    })

    describe('when the user is not an org owner', () => {
      it('returns a 403', async () => {
        const response = await server.inject({
          headers: { authorization: `Bearer ${createSortJwt(user3.id)}` },
          method: 'PATCH',
          url: `/v2/orgs/${org1.slug}/databases/${mockPrivateDbs[0].slug}`,
          payload: {
            slug: 'new-slug'
          }
        })

        expect(response.json()).toEqual({
          type: 'error',
          payload: {
            error: {
              message: 'Only organization owners can update databases.'
            }
          }
        })
        expect(response.statusCode).toBe(403)
      })
    })

    describe('when the database is not found', () => {
      it('returns a 404', async () => {
        const response = await server.inject({
          headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
          method: 'PATCH',
          url: `/v2/orgs/${org1.slug}/databases/kdfakdjsfkjasdf`,
          payload: {
            slug: 'new-slug'
          }
        })

        expect(response.statusCode).toBe(404)

        expect(response.json()).toEqual({
          type: 'error',
          payload: {
            error: {
              message: 'Database not found.'
            }
          }
        })
      })
    })

    describe('when the database is found', () => {
      describe('when no values are passed in the payload', () => {
        it('rejects with http 400', async () => {
          const mockDb = await KyselyService.getDb()
            .selectFrom('metadata_database')
            .where('organization_id', '=', org1.id)
            .selectAll()
            .executeTakeFirstOrThrow()

          const payload = {}

          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
            method: 'PATCH',
            url: `/v2/orgs/${org1.slug}/databases/${mockDb.slug}`,
            payload
          })

          expect(response.statusCode).toBe(400)

          expect(response.json()).toEqual({
            type: 'validation_error',
            payload: {
              validation_error: {
                context: 'body',
                errors: {
                  body: {
                    $root: 'cannot be an empty object'
                  }
                },
                message: 'A validation error occurred when validating the body.'
              }
            }
          })
        })
      })

      describe('when a single value is passed in the payload', () => {
        it('updates and replies w/ the database', async () => {
          const mockDb = await KyselyService.getDb()
            .selectFrom('metadata_database')
            .where('slug', '=', mockPrivateDbs[0].slug)
            .where('organization_id', '=', org1.id)
            .selectAll()
            .executeTakeFirstOrThrow()

          const payload = {
            slug: 'great-new-slug'
          }

          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
            method: 'PATCH',
            url: `/v2/orgs/${org1.slug}/databases/${mockDb.slug}`,
            payload
          })

          expect(response.statusCode).toBe(200)

          expect(response.json()).toEqual({
            type: 'update_database',
            payload: {
              database: {
                ...mockDb,
                ...payload,
                organization_slug: org1.slug
              }
            }
          })
        })
      })

      describe('when nulls are passed in the payload', () => {
        it('updates and replies w/ the database', async () => {
          const mockDb = await KyselyService.getDb()
            .selectFrom('metadata_database')
            .where('raw_name', '=', mockPrivateDbs[0].raw_name)
            .where('organization_id', '=', org1.id)
            .selectAll()
            .executeTakeFirstOrThrow()

          const payload = {
            display_name: null,
            summary: null,
            description: null,
            link: null
          }

          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
            method: 'PATCH',
            url: `/v2/orgs/${org1.slug}/databases/${mockDb.slug}`,
            payload
          })

          expect(response.json()).toEqual({
            type: 'update_database',
            payload: {
              database: {
                ...mockDb,
                ...payload,
                organization_slug: org1.slug
              }
            }
          })

          expect(response.statusCode).toBe(200)
        })
      })

      describe('when all values are passed in the payload', () => {
        it('updates and replies w/ the database', async () => {
          const mockDb = await KyselyService.getDb()
            .selectFrom('metadata_database')
            .where('raw_name', '=', mockPrivateDbs[0].raw_name)
            .where('organization_id', '=', org1.id)
            .selectAll()
            .executeTakeFirstOrThrow()

          const payload = {
            slug: 'new-slug-123',
            display_name: 'new display name',
            summary: 'new summary',
            description: 'new description',
            link: 'https://example.com/abc'
          }

          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
            method: 'PATCH',
            url: `/v2/orgs/${org1.slug}/databases/${mockDb.slug}`,
            payload
          })

          expect(response.statusCode).toBe(200)

          expect(response.json()).toEqual({
            type: 'update_database',
            payload: {
              database: {
                ...mockDb,
                ...payload,
                organization_slug: org1.slug
              }
            }
          })
        })
      })
    })
  })

  describe('list_schema_tables operation', () => {
    describe('when the organization does not exist', () => {
      it('should respond with HTTP 404', async () => {
        const response = await server.inject({
          headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
          method: 'GET',
          url: `/v2/orgs/invalid/databases/${randomUUID()}/schemas/${randomUUID()}/tables`
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

    describe('when the organization exists and db does not', () => {
      it('should respond with HTTP 404', async () => {
        const uuid = randomUUID()

        const response = await server.inject({
          headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
          method: 'GET',
          url: `/v2/orgs/${org1.slug}/databases/${uuid}/schemas/${uuid}/tables`
        })

        expect(response.statusCode).toBe(404)
        expect(response.json()).toEqual({
          type: 'error',
          payload: {
            error: {
              message: 'Database not found.'
            }
          }
        })
      })
    })

    describe('when connection.visibility is private', () => {
      describe('when user does not belong to the org', () => {
        it('should respond with HTTP 404', async () => {
          const dbSlug = await getDbSlug({
            connectionId: conn1.id,
            databaseRawName: 'sort_xyz'
          })

          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(user2.id)}` },
            method: 'GET',
            url: `/v2/orgs/${org1.slug}/databases/${dbSlug}/schemas/ethereum/tables`
          })

          expect(response.statusCode).toBe(404)
          expect(response.json()).toEqual({
            type: 'error',
            payload: {
              error: {
                message: 'Database not found.'
              }
            }
          })
        })
      })

      describe('when the user belongs to the org', () => {
        const tests = [
          {
            name: 'when "include" querystring not set',
            qs: '',
            expected: expect.arrayContaining(
              publicTables.map(tableName =>
                expectTable({ tableName, columns: false })
              )
            )
          },
          {
            name: 'when "include" querystring set to "columns"',
            qs: '?include=columns',
            expected: expect.arrayContaining(
              publicTables.map(tableName =>
                expectTable({ tableName, columns: true })
              )
            )
          }
        ]

        describe.each(tests)('$name', ({ qs, expected }) => {
          it('replies with snapshot tables', async () => {
            const dbSlug = await getDbSlug({
              connectionId: conn1.id,
              databaseRawName: 'sort_xyz'
            })

            const response = await server.inject({
              headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
              method: 'GET',
              url: `/v2/orgs/${org1.slug}/databases/${dbSlug}/schemas/public/tables${qs}`
            })

            expect(response.statusCode).toBe(200)
            expect(response.json()).toEqual({
              type: 'list_schema_tables',
              payload: {
                tables: expected
              }
            })
          })
        })
      })
    })

    describe('when connection.visibility is public', () => {
      describe('when user does not belong to the org', () => {
        it('replies with snapshot tables', async () => {
          const dbSlug = await getDbSlug({
            connectionId: conn3.id,
            databaseRawName: 'sort_xyz'
          })

          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(user2.id)}` },
            method: 'GET',
            url: `/v2/orgs/${org1.slug}/databases/${dbSlug}/schemas/public/tables`
          })

          expect(response.statusCode).toBe(200)
          expect(response.json()).toEqual({
            type: 'list_schema_tables',
            payload: {
              tables: expect.arrayContaining(
                publicTables.map(tableName => expectTable({ tableName }))
              )
            }
          })
        })
      })
    })

    describe('when the schema does not exist', () => {
      it('should respond with HTTP 404', async () => {
        const dbSlug = await getDbSlug({
          connectionId: conn1.id,
          databaseRawName: 'sort_xyz'
        })

        const response = await server.inject({
          headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
          method: 'GET',
          url: `/v2/orgs/${
            org1.slug
          }/databases/${dbSlug}/schemas/${randomUUID()}/tables`
        })

        expect(response.statusCode).toBe(404)
        expect(response.json()).toEqual({
          type: 'error',
          payload: {
            error: {
              message: 'Schema not found.'
            }
          }
        })
      })
    })
  })

  describe('list_table_columns operation', () => {
    describe('when the organization does not exist', () => {
      it('should respond with HTTP 404', async () => {
        const uuid = randomUUID()

        const response = await server.inject({
          headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
          method: 'GET',
          url: `/v2/orgs/invalid/databases/${uuid}/schemas/${uuid}/tables/${uuid}/columns`
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

    describe('when the organization does exist and database does not', () => {
      it('should respond with HTTP 404', async () => {
        const uuid = randomUUID()

        const response = await server.inject({
          headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
          method: 'GET',
          url: `/v2/orgs/${org1.slug}/databases/${uuid}/schemas/x/tables/x/columns`
        })

        expect(response.json()).toEqual({
          type: 'error',
          payload: {
            error: {
              message: 'Database not found.'
            }
          }
        })
        expect(response.statusCode).toBe(404)
      })
    })

    describe('when connection.visibility is private', () => {
      describe('when user does not belong to the org', () => {
        it('replies with 404', async () => {
          const dbSlug = await getDbSlug({
            connectionId: conn1.id,
            databaseRawName: 'sort_xyz'
          })

          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(user2.id)}` },
            method: 'GET',
            url: `/v2/orgs/${org1.slug}/databases/${dbSlug}/schemas/ethereum/tables/block/columns`
          })

          expect(response.json()).toEqual({
            type: 'error',
            payload: {
              error: {
                message: 'Database not found.'
              }
            }
          })
          expect(response.statusCode).toBe(404)
        })
      })

      describe('when the user belongs to the org', () => {
        it('replies with table columns', async () => {
          const dbSlug = await getDbSlug({
            connectionId: conn1.id,
            databaseRawName: 'sort_xyz'
          })

          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
            method: 'GET',
            url: `/v2/orgs/${org1.slug}/databases/${dbSlug}/schemas/public/tables/role/columns`
          })

          expect(response.json()).toEqual({
            type: 'list_table_columns',
            payload: {
              columns: expect.arrayContaining(['id', 'name'].map(expectColumn))
            }
          })
          expect(response.statusCode).toBe(200)
        })
      })
    })

    describe('when connection.visibility is public', () => {
      describe('when user does not belong to the org', () => {
        it('replies with snapshot columns', async () => {
          const dbSlug = await getDbSlug({
            connectionId: conn3.id,
            databaseRawName: 'sort_xyz'
          })

          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(user2.id)}` },
            method: 'GET',
            url: `/v2/orgs/${org1.slug}/databases/${dbSlug}/schemas/public/tables/role/columns`
          })

          expect(response.statusCode).toBe(200)
          expect(response.json()).toEqual({
            type: 'list_table_columns',
            payload: {
              columns: expect.arrayContaining(['id', 'name'].map(expectColumn))
            }
          })
        })

        it('replies with snapshot columns with UI friendly column types', async () => {
          const dbSlug = await getDbSlug({
            connectionId: conn3.id,
            databaseRawName: 'sort_xyz'
          })

          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(user2.id)}` },
            method: 'GET',
            url: `/v2/orgs/${org1.slug}/databases/${dbSlug}/schemas/public/tables/role/columns`
          })

          const columns = response.json().payload.columns
          const table = await getTableFromCurrentSnapshot(
            conn3.id,
            'sort_xyz',
            'public',
            'role'
          )
          const columnTypes = await getColumnsByTableId(table!.id)

          const colTypeMapper = getColumnTypeMapper(conn3)

          for (const col of columns) {
            expect(col.type).toBe(
              colTypeMapper(
                conn3,
                columnTypes.find(c => c.name === col.name)!.type
              )
            )
          }
        })
      })
    })

    describe('when the schema does not exist', () => {
      it('should respond with HTTP 404', async () => {
        const dbSlug = await getDbSlug({
          connectionId: conn3.id,
          databaseRawName: 'sort_xyz'
        })

        const response = await server.inject({
          headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
          method: 'GET',
          url: `/v2/orgs/${
            org1.slug
          }/databases/${dbSlug}/schemas/${randomUUID()}/tables/block/columns`
        })

        expect(response.statusCode).toBe(404)
        expect(response.json()).toEqual({
          type: 'error',
          payload: {
            error: {
              message: 'Schema not found.'
            }
          }
        })
      })
    })

    describe('when the table does not exist', () => {
      it('should respond with HTTP 404', async () => {
        const dbSlug = await getDbSlug({
          connectionId: conn3.id,
          databaseRawName: 'sort_xyz'
        })

        const response = await server.inject({
          headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
          method: 'GET',
          url: `/v2/orgs/${
            org1.slug
          }/databases/${dbSlug}/schemas/public/tables/${randomUUID()}/columns`
        })

        expect(response.statusCode).toBe(404)
        expect(response.json()).toEqual({
          type: 'error',
          payload: {
            error: {
              message: 'Table not found.'
            }
          }
        })
      })
    })
  })

  describe('list_database_schemas operation', () => {
    testInvalidSortAuthHeaders({
      method: 'GET',
      url: '/v2/orgs/some-org-slug/databases/some-db-slug/schemas'
    })

    describe('when the organization does not exist', () => {
      it('should respond with HTTP 404', async () => {
        const response = await server.inject({
          headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
          method: 'GET',
          url: `/v2/orgs/${randomUUID()}/databases/${randomUUID()}/schemas`
        })

        expect(response.json()).toEqual({
          type: 'error',
          payload: {
            error: {
              message: 'Organization not found.'
            }
          }
        })
        expect(response.statusCode).toBe(404)
      })
    })

    describe('when the organization does exist and database does not', () => {
      it('should respond with HTTP 404', async () => {
        const response = await server.inject({
          headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
          method: 'GET',
          url: `/v2/orgs/${org1.slug}/databases/${randomUUID()}/schemas`
        })

        expect(response.json()).toEqual({
          type: 'error',
          payload: {
            error: {
              message: 'Database not found.'
            }
          }
        })
        expect(response.statusCode).toBe(404)
      })
    })

    describe('when connection.visibility is private', () => {
      describe('when user does not belong to the org', () => {
        it('replies with 404', async () => {
          const dbSlug = await getDbSlug({
            connectionId: conn1.id,
            databaseRawName: 'sort_xyz'
          })

          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(user2.id)}` },
            method: 'GET',
            url: `/v2/orgs/${org1.slug}/databases/${dbSlug}/schemas`
          })

          expect(response.json()).toEqual({
            type: 'error',
            payload: {
              error: {
                message: 'Database not found.'
              }
            }
          })
          expect(response.statusCode).toBe(404)
        })
      })

      describe('when the user belongs to the org', () => {
        it('replies with database schemas', async () => {
          const dbSlug = await getDbSlug({
            connectionId: conn1.id,
            databaseRawName: 'sort_xyz'
          })

          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
            method: 'GET',
            url: `/v2/orgs/${org1.slug}/databases/${dbSlug}/schemas`
          })

          const body = response.json()
          expect(body).toEqual({
            type: 'list_database_schemas',
            payload: {
              schemas: expect.arrayContaining([
                expectSchema({ schemaName: 'public' }),
                expectSchema({ schemaName: 'test' })
              ])
            }
          })
          expect(body.payload.schemas.length).toBe(2)
          expect(response.statusCode).toBe(200)
        })
      })
    })

    describe('when connection.visibility is public', () => {
      describe('when user does not belong to the org', () => {
        const tests = [
          {
            name: 'when "include" querystring not set',
            qs: '',
            expected: expect.arrayContaining([
              expectSchema({ schemaName: 'public' }),
              expectSchema({ schemaName: 'test' })
            ])
          },
          {
            name: 'when "include" querystring set to "tables"',
            qs: '?include=tables',
            expected: expect.arrayContaining([
              expectSchema({ schemaName: 'public', tables: true }),
              expectSchema({ schemaName: 'test', tables: true })
            ])
          },
          {
            name: 'when "include" querystring set to "columns"',
            qs: '?include=columns',
            expected: expect.arrayContaining([
              expectSchema({
                schemaName: 'public',
                tables: true,
                columns: true
              }),
              expectSchema({
                schemaName: 'test',
                tables: true,
                columns: true
              })
            ])
          }
        ]

        describe.each(tests)('$name', ({ qs, expected }) => {
          it('replies with database schemas', async () => {
            const dbSlug = await getDbSlug({
              connectionId: conn3.id,
              databaseRawName: 'sort_xyz'
            })

            const response = await server.inject({
              headers: { authorization: `Bearer ${createSortJwt(user2.id)}` },
              method: 'GET',
              url: `/v2/orgs/${org1.slug}/databases/${dbSlug}/schemas${qs}`
            })

            const body = response.json()
            expect(body).toEqual({
              type: 'list_database_schemas',
              payload: {
                schemas: expected
              }
            })
            expect(body.payload.schemas.length).toBe(2)
            expect(response.statusCode).toBe(200)
          })
        })
      })
    })
  })
})
