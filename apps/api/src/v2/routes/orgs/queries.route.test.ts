/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { randomUUID } from 'node:crypto'

import { getConfig as getKyselyConfig, disconnectKysely } from '@sort/shared'
import {
  ConnectionMock,
  snowflakeConnectionMockPartial
} from '@sort/shared/mocks/connection.mock'
import { OrganizationMock } from '@sort/shared/mocks/org.mock'
import { UserMock } from '@sort/shared/mocks/user.mock'
import * as ConnectionService from '@sort/shared/services/connection.service'
import * as MetadataDatabaseService from '@sort/shared/services/kysely/metadata/database.service'
import * as OrganizationService from '@sort/shared/services/org.service'
import * as QueryStorageService from '@sort/shared/services/query/storage.service'
import * as UserService from '@sort/shared/services/user.service'
import { createSchemaImporter } from '@sort/shared/utils/schema-import.util'
import { iso8601RegExp } from '@sort/shared/utils/string.util'

import { config } from '../../../config/bootstrap'
import * as KyselyService from '../../../global/services/kysely.service'
import { getTestServer } from '../../../global/utils/test.util'
import { createFastifyMockLogger } from '../../mocks/fastify-logger.mock'
import { SnapshotMock } from '../../mocks/snapshot/snapshot.mock'
import { createSortJwt } from '../../utils/jwt.util'
import { testInvalidSortAuthHeaders, getDbSlug } from '../../utils/test.util'

import type * as QueryExecutionSchema from '@sort/shared/schemas/query-execution.schema'
import type { ConnectionSelectWithEncryption } from '@sort/shared/types/kysely/connection/connection.type'

describe('/v2 queries routes', () => {
  const userMock = new UserMock()
  const user1 = userMock.create()
  const user2 = userMock.create({ email: 'a@a.com' })
  const orgMock = new OrganizationMock()
  const org1 = orgMock.create({ created_by: user1.id })
  const org2 = orgMock.create({ created_by: user2.id })
  const connMock = new ConnectionMock()
  const readOnlyConn1 = connMock.create({
    organization_id: org1.id,
    created_by: user1.id
  })
  const conn1 = connMock.create({
    organization_id: org1.id,
    created_by: user1.id,
    readonly_connection_id: readOnlyConn1.id
  })
  const conn2 = connMock.create({
    organization_id: org2.id,
    created_by: user2.id
  })
  const conn3 = connMock.create({
    organization_id: org1.id,
    created_by: user1.id,
    visibility: 'public'
  })
  let readonlySnowflakeConn: ConnectionSelectWithEncryption
  let conn4: ConnectionSelectWithEncryption

  const snapshotMock = new SnapshotMock()

  let server: Awaited<ReturnType<typeof getTestServer>>

  async function cleanUpQueries(userIds: string[]) {
    await KyselyService.getDb()
      .deleteFrom('query')
      .where('created_by', 'in', userIds)
      .execute()
  }

  beforeAll(async () => {
    server = await getTestServer()

    KyselyService.createKysely()

    const snowflakeConnStr = config.TEST_SNOWFLAKE_HYBRID_CONNECTION_STRING
    readonlySnowflakeConn = connMock.create({
      ...snowflakeConnectionMockPartial,
      connection_string: snowflakeConnStr,
      id: randomUUID(),
      organization_id: org1.id,
      created_by: user1.id,
      visibility: 'public'
    })
    conn4 = connMock.create({
      ...snowflakeConnectionMockPartial,
      connection_string: snowflakeConnStr,
      id: randomUUID(),
      readonly_connection_id: readonlySnowflakeConn.id,
      organization_id: org1.id,
      created_by: user1.id,
      visibility: 'public'
    })

    await UserService.createUser(user1)
    await UserService.createUser(user2)
    await OrganizationService.create(org1)
    await OrganizationService.create(org2)
    await ConnectionService.create(readOnlyConn1)
    await ConnectionService.create(conn1)
    await ConnectionService.create(conn2)
    await ConnectionService.create(conn3)
    await ConnectionService.create(readonlySnowflakeConn)
    await ConnectionService.create(conn4)

    const log = createFastifyMockLogger()

    const privateImporter = createSchemaImporter(conn1)
    snapshotMock.push(await privateImporter.importSchema(user1.id, log))

    const otherImporter = createSchemaImporter(conn2)
    snapshotMock.push(await otherImporter.importSchema(user2.id, log))

    const publicImporter = createSchemaImporter(conn3)
    snapshotMock.push(await publicImporter.importSchema(user1.id, log))

    const snowflakeImporter = createSchemaImporter(conn4)
    snapshotMock.push(await snowflakeImporter.importSchema(user1.id, log))
  }, 25000)

  afterAll(async () => {
    const userIds = userMock.mocks.map(m => m.id)
    await cleanUpQueries(userIds)

    await connMock.removeAll()

    await KyselyService.getDb()
      .deleteFrom('organization_user')
      .where('user_id', 'in', userIds)
      .execute()

    await orgMock.removeAll()
    await userMock.removeAll()
    await snapshotMock.removeAll()

    await KyselyService.disconnectKysely()
    await disconnectKysely()
  })

  describe('run_query operation', () => {
    testInvalidSortAuthHeaders({
      method: 'POST',
      url: `/v2/orgs/${org1.slug}/query`
    })

    describe('when connection does not belong to the org', () => {
      it('replies with HTTP 404', async () => {
        const dbSlug = await getDbSlug({
          connectionId: conn2.id,
          databaseRawName: 'sort_xyz'
        })

        const response = await server.inject({
          headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
          method: 'POST',
          url: `/v2/orgs/${org1.slug}/query`,
          body: {
            database_slug: dbSlug,
            query: {
              type: 'intent',
              intent: {
                dml: 'SELECT',
                schema: 'public',
                table: 'user',
                columns: ['id', 'email', 'username', 'administrator', 'name'],
                combinator: 'AND',
                filters: [
                  { column: 'email', op: '=', value: user1.email! },
                  { column: 'name', op: '=', value: user1.name! }
                ],
                orders: [{ column: 'id', direction: 'ASC' }],
                limit: 100
              }
            }
          }
        })

        expect(response.json()).toEqual({
          type: 'error',
          payload: {
            error: {
              message: 'Connection not found.'
            }
          }
        })
        expect(response.statusCode).toBe(404)
      })
    })

    describe('when connection.visibility is private', () => {
      describe('when user is not a member of the org', () => {
        it('replies with HTTP 404', async () => {
          const dbSlug = await getDbSlug({
            connectionId: conn1.id,
            databaseRawName: 'sort_xyz'
          })

          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(user2.id)}` },
            method: 'POST',
            url: `/v2/orgs/${org1.slug}/query`,
            body: {
              database_slug: dbSlug,
              query: {
                type: 'intent',
                intent: {
                  dml: 'SELECT',
                  schema: 'public',
                  table: 'user',
                  columns: ['id', 'email', 'username', 'administrator', 'name'],
                  combinator: 'AND',
                  filters: [
                    { column: 'email', op: '=', value: user1.email! },
                    { column: 'name', op: '=', value: user1.name! }
                  ],
                  orders: [{ column: 'id', direction: 'ASC' }],
                  limit: 100
                }
              }
            }
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

      describe('when user is a member of the org', () => {
        const intentQuery = {
          type: 'intent',
          intent: {
            dml: 'SELECT',
            schema: 'public',
            table: 'user',
            columns: ['id', 'email', 'username', 'administrator', 'name'],
            combinator: 'AND',
            filters: [
              { column: 'email', op: '=', value: user1.email! },
              { column: 'name', op: '=', value: user1.name! }
            ],
            orders: [{ column: 'id', direction: 'ASC' }],
            limit: 100
          }
        } satisfies QueryExecutionSchema.Query

        const sqlQuery = {
          type: 'sql',
          sql: `SELECT id, email, username, administrator, name FROM public.user WHERE email = '${user1.email}' AND name = '${user1.name}' ORDER BY id ASC LIMIT 1`
        } satisfies QueryExecutionSchema.Query

        describe.each([intentQuery, sqlQuery])(
          'in postgres, for type $type of queries',
          query => {
            it('replies with results', async () => {
              const dbSlug = await getDbSlug({
                connectionId: conn1.id,
                databaseRawName: 'sort_xyz'
              })

              const response = await server.inject({
                headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
                method: 'POST',
                url: `/v2/orgs/${org1.slug}/query`,
                body: {
                  database_slug: dbSlug,
                  query
                }
              })

              const body = response.json()
              expect(body).toEqual({
                type: 'run_query',
                payload: {
                  result: {
                    columns: [
                      { name: 'id', type: 'string' },
                      { name: 'email', type: 'string' },
                      { name: 'username', type: 'string' },
                      { name: 'administrator', type: 'boolean' },
                      { name: 'name', type: 'string' }
                    ],
                    duration_ms: expect.any(Number),
                    query: expect.stringMatching(
                      /^.*SELECT.*FROM.*WHERE.*ORDER BY.*/gims
                    ),
                    records: [
                      [
                        user1.id,
                        user1.email,
                        user1.username,
                        user1.administrator,
                        user1.name
                      ]
                    ]
                  }
                }
              })

              expect(response.statusCode).toBe(200)
            })
          }
        )

        const snowflakeIntentQuery = {
          type: 'intent',
          intent: {
            dml: 'SELECT',
            schema: 'PUBLIC',
            table: 'BANK_ROUTING',
            columns: ['BANK_ID', 'ADDRESS', 'CITY', 'FED_ID'],
            combinator: 'AND',
            filters: [
              { column: 'FED_ID', op: '=', value: 'GA303094470877372245711' }
            ],
            orders: [{ column: 'BANK_ID', direction: 'ASC' }],
            limit: 1
          }
        } satisfies QueryExecutionSchema.Query

        const snowflakeSqlQuery = {
          type: 'sql',
          sql: 'SELECT BANK_ID, ADDRESS, CITY, FED_ID FROM "PUBLIC"."BANK_ROUTING" WHERE "FED_ID" = \'GA303094470877372245711\' ORDER BY "BANK_ID" ASC LIMIT 1'
        } satisfies QueryExecutionSchema.Query

        describe.each([snowflakeIntentQuery, snowflakeSqlQuery])(
          'in snowflake, for type $type of queries',
          query => {
            it('replies with results', async () => {
              const dbSlug = await getDbSlug({
                connectionId: conn4.id,
                databaseRawName: 'FED_BANKS'
              })

              const response = await server.inject({
                headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
                method: 'POST',
                url: `/v2/orgs/${org1.slug}/query`,
                body: {
                  database_slug: dbSlug,
                  query
                }
              })

              const body = response.json()
              expect(body).toEqual({
                type: 'run_query',
                payload: {
                  result: {
                    columns: [
                      { name: 'BANK_ID', type: 'string' },
                      { name: 'ADDRESS', type: 'string' },
                      { name: 'CITY', type: 'string' },
                      { name: 'FED_ID', type: 'string' }
                    ],
                    duration_ms: expect.any(Number),
                    query: expect.stringMatching(
                      /^.*SELECT.*FROM.*ORDER BY.*/gims
                    ),
                    records: [
                      [
                        '011000015O0110000150122415000000000FEDERAL RESERVE BANK                ',
                        '1000 PEACHTREE ST N.E.              ',
                        'ATLANTA             ',
                        'GA303094470877372245711'
                      ]
                    ]
                  }
                }
              })

              expect(response.statusCode).toBe(200)
            }, 20000)
          }
        )

        describe('for intent queries', () => {
          it('applies LIMIT to queries', async () => {
            const dbSlug = await getDbSlug({
              connectionId: conn1.id,
              databaseRawName: 'sort_xyz'
            })

            const response = await server.inject({
              headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
              method: 'POST',
              url: `/v2/orgs/${org1.slug}/query`,
              body: {
                database_slug: dbSlug,
                query: {
                  type: 'intent',
                  intent: {
                    dml: 'SELECT',
                    schema: 'public',
                    table: 'role',
                    columns: ['id', 'name'],
                    combinator: 'AND',
                    filters: [],
                    orders: [{ column: 'id', direction: 'ASC' }],
                    limit: 1
                  }
                }
              }
            })

            const body = response.json()
            expect(body).toEqual({
              type: 'run_query',
              payload: {
                result: {
                  columns: [
                    { name: 'id', type: 'numeric' },
                    { name: 'name', type: 'string' }
                  ],
                  duration_ms: expect.any(Number),
                  query: expect.stringMatching(
                    /^.*SELECT.*FROM.*ORDER BY.*LIMIT.*/gims
                  ),
                  records: [[0, 'owner']]
                }
              }
            })

            expect(response.statusCode).toBe(200)
          })

          describe('when LIMIT is not set', () => {
            it('replies with validation error', async () => {
              const dbSlug = await getDbSlug({
                connectionId: conn1.id,
                databaseRawName: 'sort_xyz'
              })

              const response = await server.inject({
                headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
                method: 'POST',
                url: `/v2/orgs/${org1.slug}/query`,
                body: {
                  database_slug: dbSlug,
                  query: {
                    type: 'intent',
                    intent: {
                      dml: 'SELECT',
                      schema: 'public',
                      table: 'role',
                      columns: ['id', 'name'],
                      combinator: 'AND',
                      filters: [],
                      orders: [{ column: 'id', direction: 'ASC' }]
                    }
                  }
                }
              })

              const body = response.json()
              expect(body).toEqual({
                type: 'validation_error',
                payload: {
                  validation_error: {
                    context: 'body',
                    message:
                      'A validation error occurred when validating the body.',
                    errors: {
                      body: {
                        'query/intent/limit': 'is required'
                      }
                    }
                  }
                }
              })

              expect(response.statusCode).toBe(400)
            })
          })

          describe('when postgres parsing errors', () => {
            it('are caused by invalid uuid comparison', async () => {
              const dbSlug = await getDbSlug({
                connectionId: conn1.id,
                databaseRawName: 'sort_xyz'
              })

              const response = await server.inject({
                headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
                method: 'POST',
                url: `/v2/orgs/${org1.slug}/query`,
                body: {
                  database_slug: dbSlug,
                  query: {
                    type: 'intent',
                    intent: {
                      dml: 'SELECT',
                      schema: 'public',
                      table: 'snapshot',
                      columns: ['id'],
                      combinator: 'AND',
                      filters: [{ column: 'id', op: '=', value: '8238238' }],
                      orders: [{ column: 'id', direction: 'ASC' }],
                      limit: 100
                    }
                  }
                }
              })

              const body = response.json()
              expect(body).toEqual({
                type: 'error',
                payload: {
                  error: {
                    message: expect.stringContaining(
                      'Something went wrong while executing your query. `error: invalid input syntax for type uuid: "8238238".`'
                    )
                  }
                }
              })

              expect(response.statusCode).toBe(422)
            })

            it('are caused by invalid datetime comparison', async () => {
              const dbSlug = await getDbSlug({
                connectionId: conn1.id,
                databaseRawName: 'sort_xyz'
              })

              const response = await server.inject({
                headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
                method: 'POST',
                url: `/v2/orgs/${org1.slug}/query`,
                body: {
                  database_slug: dbSlug,
                  query: {
                    type: 'intent',
                    intent: {
                      columns: [
                        'id',
                        'type',
                        'sql',
                        'intent',
                        'connection_id',
                        'database_name',
                        'name',
                        'description',
                        'created_by',
                        'created_at',
                        'updated_at'
                      ],
                      combinator: 'AND',
                      dml: 'SELECT',
                      filters: [{ column: 'created_at', op: '=', value: 'j' }],
                      limit: 100,
                      orders: [],
                      schema: 'public',
                      table: 'query'
                    }
                  }
                }
              })

              const body = response.json()
              expect(body).toEqual({
                type: 'error',
                payload: {
                  error: {
                    message: expect.stringContaining(
                      'Something went wrong while executing your query. `error: invalid input syntax for type timestamp: "j".`'
                    )
                  }
                }
              })

              expect(response.statusCode).toBe(422)
            })
          })

          describe('when snowflake parsing errors', () => {
            it('are caused by invalid date comparison', async () => {
              const dbSlug = await getDbSlug({
                connectionId: conn4.id,
                databaseRawName: 'SNOWFLAKE_SAMPLE_DATA'
              })

              const response = await server.inject({
                headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
                method: 'POST',
                url: `/v2/orgs/${org1.slug}/query`,
                body: {
                  database_slug: dbSlug,
                  query: {
                    type: 'intent',
                    intent: {
                      columns: [
                        'CC_CALL_CENTER_SK',
                        'CC_CALL_CENTER_ID',
                        'CC_REC_START_DATE',
                        'CC_REC_END_DATE',
                        'CC_CLOSED_DATE_SK',
                        'CC_OPEN_DATE_SK',
                        'CC_NAME',
                        'CC_CLASS',
                        'CC_EMPLOYEES',
                        'CC_SQ_FT',
                        'CC_HOURS',
                        'CC_MANAGER',
                        'CC_MKT_ID',
                        'CC_MKT_CLASS',
                        'CC_MKT_DESC',
                        'CC_MARKET_MANAGER',
                        'CC_DIVISION',
                        'CC_DIVISION_NAME',
                        'CC_COMPANY',
                        'CC_COMPANY_NAME',
                        'CC_STREET_NUMBER',
                        'CC_STREET_NAME',
                        'CC_STREET_TYPE',
                        'CC_SUITE_NUMBER',
                        'CC_CITY',
                        'CC_COUNTY',
                        'CC_STATE',
                        'CC_ZIP',
                        'CC_COUNTRY',
                        'CC_GMT_OFFSET',
                        'CC_TAX_PERCENTAGE'
                      ],
                      combinator: 'AND',
                      dml: 'SELECT',
                      filters: [
                        { column: 'CC_REC_START_DATE', op: '=', value: 's' }
                      ],
                      limit: 100,
                      orders: [],
                      schema: 'TPCDS_SF100TCL',
                      table: 'CALL_CENTER'
                    }
                  }
                }
              })

              const body = response.json()
              expect(body).toEqual({
                type: 'error',
                payload: {
                  error: {
                    message: expect.stringContaining(
                      "Something went wrong while executing your query. `OperationFailedError: Date 's' is not recognized.`"
                    )
                  }
                }
              })

              expect(response.statusCode).toBe(422)
            }, 20000)

            it('are caused by invalid string, numeric comparison', async () => {
              const dbSlug = await getDbSlug({
                connectionId: conn4.id,
                databaseRawName: 'SNOWFLAKE_SAMPLE_DATA'
              })

              const response = await server.inject({
                headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
                method: 'POST',
                url: `/v2/orgs/${org1.slug}/query`,
                body: {
                  database_slug: dbSlug,
                  query: {
                    type: 'intent',
                    intent: {
                      columns: [
                        'CC_CALL_CENTER_SK',
                        'CC_CALL_CENTER_ID',
                        'CC_REC_START_DATE',
                        'CC_REC_END_DATE',
                        'CC_CLOSED_DATE_SK',
                        'CC_OPEN_DATE_SK',
                        'CC_NAME',
                        'CC_CLASS',
                        'CC_EMPLOYEES',
                        'CC_SQ_FT',
                        'CC_HOURS',
                        'CC_MANAGER',
                        'CC_MKT_ID',
                        'CC_MKT_CLASS',
                        'CC_MKT_DESC',
                        'CC_MARKET_MANAGER',
                        'CC_DIVISION',
                        'CC_DIVISION_NAME',
                        'CC_COMPANY',
                        'CC_COMPANY_NAME',
                        'CC_STREET_NUMBER',
                        'CC_STREET_NAME',
                        'CC_STREET_TYPE',
                        'CC_SUITE_NUMBER',
                        'CC_CITY',
                        'CC_COUNTY',
                        'CC_STATE',
                        'CC_ZIP',
                        'CC_COUNTRY',
                        'CC_GMT_OFFSET',
                        'CC_TAX_PERCENTAGE'
                      ],
                      combinator: 'AND',
                      dml: 'SELECT',
                      filters: [
                        { column: 'CC_SQ_FT', op: '=', value: 'hello' }
                      ],
                      limit: 100,
                      orders: [],
                      schema: 'TPCDS_SF100TCL',
                      table: 'CALL_CENTER'
                    }
                  }
                }
              })

              const body = response.json()
              expect(body).toEqual({
                type: 'error',
                payload: {
                  error: {
                    message: expect.stringContaining(
                      "omething went wrong while executing your query. `OperationFailedError: Numeric value 'hello' is not recognized.`"
                    )
                  }
                }
              })

              expect(response.statusCode).toBe(422)
            }, 20000)

            it('are caused by returning 0 rows, do not throw, return []', async () => {
              const dbSlug = await getDbSlug({
                connectionId: conn4.id,
                databaseRawName: 'SNOWFLAKE_SAMPLE_DATA'
              })

              const response = await server.inject({
                headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
                method: 'POST',
                url: `/v2/orgs/${org1.slug}/query`,
                body: {
                  database_slug: dbSlug,
                  query: {
                    type: 'intent',
                    intent: {
                      columns: ['CC_CALL_CENTER_SK'],
                      combinator: 'AND',
                      dml: 'SELECT',
                      filters: [{ column: 'CC_MANAGER', op: '=', value: '5' }],
                      limit: 100,
                      orders: [],
                      schema: 'TPCDS_SF100TCL',
                      table: 'CALL_CENTER'
                    }
                  }
                }
              })

              const body = response.json()
              expect(body).toEqual({
                type: 'run_query',
                payload: {
                  result: {
                    columns: [{ name: 'CC_CALL_CENTER_SK', type: 'numeric' }],
                    duration_ms: expect.any(Number),
                    query: expect.stringMatching(
                      /^.*SELECT.*FROM.*LIMIT.*/gims
                    ),
                    records: []
                  }
                }
              })

              expect(response.statusCode).toBe(200)
            }, 20000)
          })

          describe('when * columns are passed', () => {
            it('replies with results with all columns', async () => {
              const dbSlug = await getDbSlug({
                connectionId: conn1.id,
                databaseRawName: 'sort_xyz'
              })

              const response = await server.inject({
                headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
                method: 'POST',
                url: `/v2/orgs/${org1.slug}/query`,
                body: {
                  database_slug: dbSlug,
                  query: {
                    type: 'intent',
                    intent: {
                      dml: 'SELECT',
                      schema: 'public',
                      table: 'role',
                      columns: ['*'],
                      combinator: 'AND',
                      filters: [],
                      orders: [],
                      limit: 2
                    }
                  }
                }
              })

              const body = response.json()
              expect(body).toEqual({
                type: 'run_query',
                payload: {
                  result: {
                    columns: [
                      { name: 'id', type: 'numeric' },
                      { name: 'name', type: 'string' }
                    ],
                    duration_ms: expect.any(Number),
                    query: expect.stringMatching(
                      /^.*SELECT.*FROM.*LIMIT.*/gims
                    ),
                    records: [
                      [0, 'owner'],
                      [1, 'member']
                    ]
                  }
                }
              })

              expect(response.statusCode).toBe(200)
            })

            it('for a table which does not exist, replies with 404', async () => {
              const dbSlug = await getDbSlug({
                connectionId: conn1.id,
                databaseRawName: 'sort_xyz'
              })

              const response = await server.inject({
                headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
                method: 'POST',
                url: `/v2/orgs/${org1.slug}/query`,
                body: {
                  database_slug: dbSlug,
                  query: {
                    type: 'intent',
                    intent: {
                      dml: 'SELECT',
                      schema: 'public',
                      table: String(Math.random()),
                      columns: ['*'],
                      combinator: 'AND',
                      filters: [],
                      orders: [],
                      limit: 2
                    }
                  }
                }
              })

              expect(response.json()).toEqual({
                type: 'error',
                payload: {
                  error: {
                    message: 'Table not found.'
                  }
                }
              })
              expect(response.statusCode).toBe(404)
            })
          })

          describe('when column contains binary data', () => {
            const testId = randomUUID()
            const testRecord = {
              id: testId,
              test_binary: Buffer.from(
                'S'.repeat(config.MAX_BINARY_STRING_LENGTH + 1)
              )
            }

            beforeAll(async () => {
              await KyselyService.getDb()
                .insertInto('test.change_request_test')
                .values(testRecord)
                .executeTakeFirst()
            })

            afterAll(async () => {
              await KyselyService.getDb()
                .deleteFrom('test.change_request_test')
                .where('id', '=', testId)
                .execute()
            })

            it('converts to base64 string', async () => {
              const dbSlug = await getDbSlug({
                connectionId: conn1.id,
                databaseRawName: 'sort_xyz'
              })

              const response = await server.inject({
                headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
                method: 'POST',
                url: `/v2/orgs/${org1.slug}/query`,
                body: {
                  database_slug: dbSlug,
                  query: {
                    type: 'intent',
                    intent: {
                      dml: 'SELECT',
                      schema: 'test',
                      table: 'change_request_test',
                      columns: ['id', 'test_binary'],
                      combinator: 'AND',
                      filters: [{ column: 'id', op: '=', value: testId }],
                      orders: [],
                      limit: 1
                    }
                  }
                }
              })

              const body = response.json()
              expect(body).toEqual({
                type: 'run_query',
                payload: {
                  result: {
                    columns: [
                      { name: 'id', type: 'uuid' },
                      { name: 'test_binary', type: 'binary' }
                    ],
                    duration_ms: expect.anything(),
                    query: expect.stringMatching(
                      /^.*SELECT.*FROM.*WHERE.*LIMIT.*/gims
                    ),
                    records: [
                      [
                        testRecord.id,
                        `${testRecord.test_binary
                          .toString()
                          .slice(0, config.MAX_BINARY_STRING_LENGTH)}...`
                      ]
                    ]
                  }
                }
              })

              expect(response.statusCode).toBe(200)
            })
          })
        })

        describe('for sql queries', () => {
          describe('postgres errors', () => {
            it('when a query with an invalid operator use is passed, returns a meaningful message', async () => {
              const dbSlug = await getDbSlug({
                connectionId: conn1.id,
                databaseRawName: 'sort_xyz'
              })

              const response = await server.inject({
                headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
                method: 'POST',
                url: `/v2/orgs/${org1.slug}/query`,
                body: {
                  database_slug: dbSlug,
                  query: {
                    type: 'sql',
                    sql: 'SELECT * FROM public.user WHERE email = 1'
                  }
                }
              })

              const body = response.json()
              expect(body).toEqual({
                type: 'error',
                payload: {
                  error: {
                    message: expect.stringContaining(
                      'No operator matches the given name and argument types. You might need to add explicit type casts.'
                    )
                  }
                }
              })

              expect(response.statusCode).toBe(422)
            })

            it('when a query with an INSERT is passed, returns a meaningful message', async () => {
              const dbSlug = await getDbSlug({
                connectionId: conn1.id,
                databaseRawName: 'sort_xyz'
              })

              const response = await server.inject({
                headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
                method: 'POST',
                url: `/v2/orgs/${org1.slug}/query`,
                body: {
                  database_slug: dbSlug,
                  query: {
                    type: 'sql',
                    sql: "insert into public.role (id, name) values (4, 'Gale');"
                  }
                }
              })

              const body = response.json()
              expect(body).toEqual({
                type: 'error',
                payload: {
                  error: {
                    message: expect.stringContaining(
                      'Only SELECT statements are supported'
                    )
                  }
                }
              })

              expect(response.statusCode).toBe(422)
            })

            it('when sql text length < 5, fails validation', async () => {
              const dbSlug = await getDbSlug({
                connectionId: conn1.id,
                databaseRawName: 'sort_xyz'
              })

              const response = await server.inject({
                headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
                method: 'POST',
                url: `/v2/orgs/${org1.slug}/query`,
                body: {
                  database_slug: dbSlug,
                  query: {
                    type: 'sql',
                    sql: 'nope'
                  }
                }
              })

              const body = response.json()
              expect(body).toEqual({
                type: 'validation_error',
                payload: {
                  validation_error: {
                    context: 'body',
                    message:
                      'A validation error occurred when validating the body.',
                    errors: {
                      body: {
                        'query/sql': 'must not have fewer than 5 characters'
                      }
                    }
                  }
                }
              })

              expect(response.statusCode).toBe(400)
            })

            it('handles ambigious reference errors', async () => {
              const dbSlug = await getDbSlug({
                connectionId: conn1.id,
                databaseRawName: 'sort_xyz'
              })

              const response = await server.inject({
                headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
                method: 'POST',
                url: `/v2/orgs/${org1.slug}/query`,
                body: {
                  database_slug: dbSlug,
                  query: {
                    type: 'sql',
                    sql: `select * from public.organization o
                      join public.organization_user ou on ou.organization_id = o.id
                      join public.user u on ou.user_id = u.id
                      order by name`
                  }
                }
              })

              const body = response.json()
              expect(body).toEqual({
                type: 'error',
                payload: {
                  error: {
                    message: expect.stringContaining(
                      'ORDER BY "name" is ambiguous.'
                    )
                  }
                }
              })

              expect(response.statusCode).toBe(422)
            })
          })

          describe('snowflake errors', () => {
            it('responds with helpful msg when invalid sql query is passed', async () => {
              const dbSlug = await getDbSlug({
                connectionId: conn4.id,
                databaseRawName: 'FED_BANKS'
              })

              const response = await server.inject({
                headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
                method: 'POST',
                url: `/v2/orgs/${org1.slug}/query`,
                body: {
                  database_slug: dbSlug,
                  query: {
                    type: 'sql',
                    sql: 'SELECT fail FROM public.bank_routing'
                  }
                }
              })

              const body = response.json()
              expect(body).toEqual({
                type: 'error',
                payload: {
                  error: {
                    message: expect.stringMatching(
                      /.*invalid identifier 'FAIL'.*/i
                    )
                  }
                }
              })

              expect(response.statusCode).toBe(422)
            }, 20000)

            it('when a query with an INSERT is passed, returns a meaningful message', async () => {
              const dbSlug = await getDbSlug({
                connectionId: conn4.id,
                databaseRawName: 'FED_BANKS'
              })

              const response = await server.inject({
                headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
                method: 'POST',
                url: `/v2/orgs/${org1.slug}/query`,
                body: {
                  database_slug: dbSlug,
                  query: {
                    type: 'sql',
                    sql: "insert into public.bank_routing (bank_id, address, city, fed_id) values (1000, '123 Fake st', 'Morgan Hill', '');"
                  }
                }
              })

              const body = response.json()
              expect(body).toEqual({
                type: 'error',
                payload: {
                  error: {
                    message: expect.stringContaining(
                      'Only SELECT statements are supported'
                    )
                  }
                }
              })

              expect(response.statusCode).toBe(422)
            }, 20000)
          })
        })
      })
    })

    describe('when connection.visibility is public', () => {
      describe('when user is not a member of the org', () => {
        it('replies with results', async () => {
          const dbSlug = await getDbSlug({
            connectionId: conn3.id,
            databaseRawName: 'sort_xyz'
          })

          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
            method: 'POST',
            url: `/v2/orgs/${org1.slug}/query`,
            body: {
              database_slug: dbSlug,
              query: {
                type: 'intent',
                intent: {
                  dml: 'SELECT',
                  schema: 'public',
                  table: 'user',
                  columns: ['id', 'email', 'username', 'administrator', 'name'],
                  combinator: 'AND',
                  filters: [
                    { column: 'email', op: '=', value: user1.email! },
                    { column: 'name', op: '=', value: user1.name! }
                  ],
                  orders: [{ column: 'id', direction: 'ASC' }],
                  limit: 100
                }
              }
            }
          })

          const body = response.json()
          expect(body).toEqual({
            type: 'run_query',
            payload: {
              result: {
                columns: [
                  { name: 'id', type: 'string' },
                  { name: 'email', type: 'string' },
                  { name: 'username', type: 'string' },
                  { name: 'administrator', type: 'boolean' },
                  { name: 'name', type: 'string' }
                ],
                duration_ms: expect.any(Number),
                query: expect.stringMatching(
                  /^.*SELECT.*FROM.*WHERE.*ORDER BY.*/gims
                ),
                records: [
                  [
                    user1.id,
                    user1.email,
                    user1.username,
                    user1.administrator,
                    user1.name
                  ]
                ]
              }
            }
          })

          expect(response.statusCode).toBe(200)
        })
      })
    })

    describe('when timeout is reached', () => {
      let originalTimeout: number
      beforeAll(() => {
        originalTimeout = config.CUSTOMER_QUERY_TIMEOUT_MS

        config.CUSTOMER_QUERY_TIMEOUT_MS = 1
        getKyselyConfig().CUSTOMER_QUERY_TIMEOUT_MS = 1
      })
      afterAll(() => {
        config.CUSTOMER_QUERY_TIMEOUT_MS = originalTimeout
        getKyselyConfig().CUSTOMER_QUERY_TIMEOUT_MS = originalTimeout
      })

      const expectTimeout = async ({
        userId,
        orgSlug,
        dbSlug,
        query
      }: {
        userId: string
        orgSlug: string
        dbSlug: string
        query: QueryExecutionSchema.Query
      }) => {
        const response = await server.inject({
          headers: { authorization: `Bearer ${createSortJwt(userId)}` },
          method: 'POST',
          url: `/v2/orgs/${orgSlug}/query`,
          body: {
            database_slug: dbSlug,
            query
          }
        })

        expect(response.json()).toEqual({
          type: 'error',
          payload: {
            error: {
              message:
                'Max query time exceeded. Tip: applying a LIMIT clause can reduce your overall query time.'
            }
          }
        })
        expect(response.statusCode).toBe(504)
      }

      describe('for postgres', () => {
        it('replies with HTTP 504', async () => {
          const query = {
            type: 'sql',
            sql: 'SELECT pg_sleep(1)' // seconds
          } satisfies QueryExecutionSchema.Query

          const dbSlug = await getDbSlug({
            connectionId: conn1.id,
            databaseRawName: 'sort_xyz'
          })

          await expectTimeout({
            userId: user1.id,
            orgSlug: org1.slug,
            dbSlug,
            query
          })
        })
      })

      describe('for snowflake', () => {
        it('replies with HTTP 504', async () => {
          const query = {
            type: 'sql',
            // sql: "select SYSTEM$WAIT(1, 'SECONDS');" // snowflake syntax not supported yet
            sql: 'SELECT * FROM "PUBLIC"."BANK_ROUTING" LIMIT 1000'
          } satisfies QueryExecutionSchema.Query

          const dbSlug = await getDbSlug({
            connectionId: conn4.id,
            databaseRawName: 'FED_BANKS'
          })

          await expectTimeout({
            userId: user1.id,
            orgSlug: org1.slug,
            dbSlug,
            query
          })
        }, 20000)
      })
    })

    describe('when query size is exceeded', () => {
      const tooManyColumns = {
        query: {
          type: 'intent',
          intent: {
            dml: 'SELECT',
            schema: 'public',
            table: 'user',
            columns: Array.from<string>({ length: 301 }).fill('h'),
            combinator: 'AND',
            filters: [],
            orders: [],
            limit: 100
          }
        } satisfies QueryExecutionSchema.Query,
        errorBody: {
          'query/intent/columns': 'must be an array with at most 300 items'
        }
      }

      const tooManyFilters = {
        query: {
          type: 'intent',
          intent: {
            dml: 'SELECT',
            schema: 'public',
            table: 'user',
            columns: ['id'],
            combinator: 'AND',
            filters: Array.from<{ column: string; op: '='; value: string }>({
              length: 76
            }).fill({ column: 'email', op: '=', value: 'test-user@sort.xyz' }),
            orders: [],
            limit: 100
          }
        } satisfies QueryExecutionSchema.Query,
        errorBody: {
          'query/intent/filters': 'must be an array with at most 75 items'
        }
      }

      const tooManyOrders = {
        query: {
          type: 'intent',
          intent: {
            dml: 'SELECT',
            schema: 'public',
            table: 'user',
            columns: ['id'],
            combinator: 'AND',
            filters: [],
            orders: Array.from<{ column: string; direction: 'ASC' }>({
              length: 26
            }).fill({ column: 'id', direction: 'ASC' }),
            limit: 100
          }
        } satisfies QueryExecutionSchema.Query,
        errorBody: {
          'query/intent/orders': 'must be an array with at most 25 items'
        }
      }

      const tooMuchSQL = {
        query: {
          type: 'sql',
          sql: `select ${'x'.repeat(20_000)} from public.user`
        } satisfies QueryExecutionSchema.Query,
        errorBody: { 'query/sql': 'must not have more than 20000 characters' }
      }

      it.each([tooManyColumns, tooManyFilters, tooManyOrders, tooMuchSQL])(
        'replies with validation error',
        async ({ query, errorBody }) => {
          const dbSlug = await getDbSlug({
            connectionId: conn1.id,
            databaseRawName: 'sort_xyz'
          })

          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
            method: 'POST',
            url: `/v2/orgs/${org1.slug}/query`,
            body: {
              database_slug: dbSlug,
              query
            }
          })

          expect(response.json()).toEqual({
            type: 'validation_error',
            payload: {
              validation_error: {
                message:
                  'A validation error occurred when validating the body.',
                context: 'body',
                errors: {
                  body: errorBody
                }
              }
            }
          })

          expect(response.statusCode).toBe(400)
        }
      )
    })
  })

  describe('create_query operation', () => {
    afterAll(async () => {
      await cleanUpQueries(userMock.mocks.map(m => m.id))
    })

    testInvalidSortAuthHeaders({
      method: 'POST',
      url: `/v2/orgs/${org1.slug}/queries`
    })

    describe('with valid data', () => {
      it('saves intent queries', async () => {
        const name = 'my query'
        const databaseRawName = 'sort_xyz'

        const query = {
          name,
          type: 'intent',
          intent: {
            dml: 'SELECT',
            schema: 'public',
            table: 'user',
            columns: ['id', 'email', 'username', 'administrator', 'name'],
            combinator: 'AND',
            filters: [
              { column: 'email', op: '=', value: user1.email! },
              { column: 'name', op: '=', value: user1.name! }
            ],
            orders: [{ column: 'id', direction: 'ASC' }],
            limit: 100
          }
        }

        const dbSlug = await getDbSlug({
          connectionId: conn1.id,
          databaseRawName
        })

        const response = await server.inject({
          headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
          method: 'POST',
          url: `/v2/orgs/${org1.slug}/queries`,
          body: {
            database_slug: dbSlug,
            query
          }
        })

        const body = response.json()
        expect(body).toEqual({
          type: 'create_query',
          payload: {
            query: {
              id: expect.any(String),
              type: query.type,
              intent: query.intent,
              sql: null,
              org_slug: org1.slug,
              database_name: databaseRawName,
              database_slug: expect.stringMatching(
                new RegExp(`^${databaseRawName}-.+`)
              ),
              connection_id: conn1.id,
              name,
              description: null,
              created_by: user1.id,
              created_by_name: user1.name,
              created_by_picture: user1.picture,
              created_by_username: user1.username,
              created_at: expect.any(String),
              updated_at: expect.any(String)
            }
          }
        })

        expect(response.statusCode).toBe(201)
      })

      it('saves sql queries', async () => {
        const name = 'Everything from my.table'
        const description = 'This is a description'

        const query = {
          name,
          description,
          type: 'sql',
          sql: 'select * from my.table'
        }

        const databaseRawName = 'sort_xyz'

        const dbSlug = await getDbSlug({
          connectionId: conn1.id,
          databaseRawName
        })

        const response = await server.inject({
          headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
          method: 'POST',
          url: `/v2/orgs/${org1.slug}/queries`,
          body: {
            database_slug: dbSlug,
            query
          }
        })

        const body = response.json()
        expect(body).toEqual({
          type: 'create_query',
          payload: {
            query: {
              id: expect.any(String),
              name,
              description,
              type: query.type,
              intent: null,
              sql: query.sql,
              org_slug: org1.slug,
              database_name: databaseRawName,
              database_slug: expect.stringMatching(
                new RegExp(`^${databaseRawName}-.+`)
              ),
              connection_id: conn1.id,
              created_by: user1.id,
              created_by_name: user1.name,
              created_by_picture: user1.picture,
              created_by_username: user1.username,
              created_at: expect.any(String),
              updated_at: expect.any(String)
            }
          }
        })

        expect(response.statusCode).toBe(201)
      })
    })

    describe('with invalid data', () => {
      describe('database_slug', () => {
        it('replies with HTTP 400', async () => {
          const query = {
            type: 'sql',
            sql: 'select * from my.table'
          }

          const dbSlug = '-nope'

          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
            method: 'POST',
            url: `/v2/orgs/${org1.slug}/queries`,
            body: {
              database_slug: dbSlug,
              name: 'hi',
              query
            }
          })

          expect(response.json()).toEqual({
            type: 'validation_error',
            payload: {
              validation_error: {
                message:
                  'A validation error occurred when validating the body.',
                context: 'body',
                errors: {
                  body: {
                    database_slug:
                      'must match pattern "^[a-zA-Z0-9]+[\\-\\._a-zA-Z0-9]*$"'
                  }
                }
              }
            }
          })

          expect(response.statusCode).toBe(400)
        })
      })
    })

    describe('with a missing query name', () => {
      it('sets name to current date', async () => {
        const query = {
          name: null,
          type: 'sql',
          sql: 'select * from my.table'
        }

        const databaseRawName = 'sort_xyz'

        const dbSlug = await getDbSlug({
          connectionId: conn1.id,
          databaseRawName
        })

        const response = await server.inject({
          headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
          method: 'POST',
          url: `/v2/orgs/${org1.slug}/queries`,
          body: {
            database_slug: dbSlug,
            query
          }
        })

        expect(response.json()).toEqual({
          type: 'create_query',
          payload: {
            query: {
              ...query,
              id: expect.any(String),
              name: expect.stringMatching(iso8601RegExp),
              intent: null,
              org_slug: org1.slug,
              description: null,
              database_name: databaseRawName,
              database_slug: dbSlug,
              connection_id: conn1.id,
              created_by: user1.id,
              created_by_name: user1.name,
              created_by_picture: user1.picture,
              created_by_username: user1.username,
              created_at: expect.stringMatching(iso8601RegExp),
              updated_at: expect.stringMatching(iso8601RegExp)
            }
          }
        })
        expect(response.statusCode).toBe(201)
      })
    })

    describe('with an public org to which the user has no permission', () => {
      it('replies with HTTP 200', async () => {
        const databaseRawName = 'sort_xyz'

        const dbSlug = await getDbSlug({
          connectionId: conn3.id,
          databaseRawName
        })

        const response = await server.inject({
          headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
          method: 'POST',
          url: `/v2/orgs/${org1.slug}/queries`,
          body: {
            database_slug: dbSlug,
            query: {
              name: 'my query',
              type: 'sql',
              sql: 'select * from my.table'
            }
          }
        })

        expect(response.json()).toEqual({
          type: 'create_query',
          payload: {
            query: {
              id: expect.any(String),
              type: 'sql',
              name: 'my query',
              intent: null,
              sql: 'select * from my.table',
              org_slug: org1.slug,
              description: null,
              database_name: databaseRawName,
              database_slug: expect.stringMatching(
                new RegExp(`^${databaseRawName}-.+`)
              ),
              connection_id: conn3.id,
              created_by: user1.id,
              created_by_name: user1.name,
              created_by_picture: user1.picture,
              created_by_username: user1.username,
              created_at: expect.any(String),
              updated_at: expect.any(String)
            }
          }
        })
        expect(response.statusCode).toBe(201)
      })
    })

    describe('for a connection to which the user has no permission', () => {
      it('replies with HTTP 404', async () => {
        const databaseRawName = 'sort_xyz'

        const dbSlug = await getDbSlug({
          connectionId: conn2.id,
          databaseRawName
        })

        const response = await server.inject({
          headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
          method: 'POST',
          url: `/v2/orgs/${org1.slug}/queries`,
          body: {
            database_slug: dbSlug,
            name: 'my query',
            query: {
              type: 'sql',
              sql: 'select * from my.table'
            }
          }
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
  })

  describe('list_queries operation', () => {
    testInvalidSortAuthHeaders({
      method: 'GET',
      url: `/v2/orgs/${org1.slug}/queries`
    })

    describe('when no queries exist', () => {
      it('replies with an empty array', async () => {
        const response = await server.inject({
          headers: { authorization: `Bearer ${createSortJwt(user2.id)}` },
          method: 'GET',
          url: `/v2/orgs/${org2.slug}/queries`
        })

        expect(response.statusCode).toBe(200)

        const body = response.json()
        expect(body).toEqual({
          type: 'list_queries',
          payload: {
            queries: []
          }
        })
      })
    })

    describe('when queries exist', () => {
      const userA = userMock.create()
      const userB = userMock.create()
      const orgA = orgMock.create({ created_by: userA.id })
      const orgB = orgMock.create({ created_by: userB.id })
      const connA = connMock.create({
        organization_id: orgA.id,
        created_by: userA.id
      })
      const connB = connMock.create({
        organization_id: orgB.id,
        created_by: userB.id
      })
      const connC = connMock.create({
        organization_id: orgA.id,
        created_by: userA.id,
        visibility: 'public'
      })

      const queryA = {
        userId: userA.id,
        databaseName: 'sort_xyz',
        connectionId: connA.id,
        query: {
          description: '# Best _Query_ **Ever**',
          type: 'sql',
          sql: 'select * from my.table'
        }
      } satisfies QueryStorageService.QueryArg

      const queryB = {
        userId: userB.id,
        databaseName: 'something',
        connectionId: connC.id,
        query: {
          name: 'Query B',
          description: 'This is query B. [sort](https://sort.xyz)',
          type: 'intent',
          intent: {
            dml: 'SELECT',
            schema: 'public',
            table: 'user',
            columns: ['*'],
            combinator: 'AND',
            filters: [],
            orders: [{ column: 'id', direction: 'ASC' }],
            limit: 10
          }
        }
      } satisfies QueryStorageService.QueryArg

      const queryC = {
        userId: userB.id,
        databaseName: 'sort_xyz',
        connectionId: connB.id,
        query: {
          name: 'queryC',
          type: 'sql',
          sql: 'select credits from other.table'
        }
      } satisfies QueryStorageService.QueryArg

      const queryD = {
        userId: user1.id,
        databaseName: 'postgres',
        connectionId: conn1.id,
        query: {
          name: 'Wont find this query',
          description: 'Some desc name',
          type: 'sql',
          sql: 'select credits from other.table'
        }
      } satisfies QueryStorageService.QueryArg

      const queryE = {
        userId: user1.id,
        databaseName: 'sort_xyz',
        connectionId: conn1.id,
        query: {
          name: 'Some query by database',
          description: 'Some desc name different database',
          type: 'sql',
          sql: 'select credits from other.table'
        }
      } satisfies QueryStorageService.QueryArg

      const insertMetadataRecord = async (
        query: QueryStorageService.QueryArg
      ) => {
        const conns = [conn1, connA, connB, connC]
        const conn = conns.find(c => c.id === query.connectionId)!

        await MetadataDatabaseService.insertMetadataDb(KyselyService.getDb(), {
          connection_id: query.connectionId,
          organization_id: conn.organization_id,
          raw_name: query.databaseName,
          slug: `${query.databaseName}-something`
        })
      }

      beforeAll(async () => {
        await UserService.createUser(userA)
        await UserService.createUser(userB)
        await OrganizationService.create(orgA)
        await OrganizationService.create(orgB)
        await ConnectionService.create(connA)
        await ConnectionService.create(connB)
        await ConnectionService.create(connC)
        await QueryStorageService.insert(queryA)
        await QueryStorageService.insert(queryB)
        await QueryStorageService.insert(queryC)
        await QueryStorageService.insert(queryD)
        await QueryStorageService.insert(queryE)
        await insertMetadataRecord(queryA)
        await insertMetadataRecord(queryB)
        await insertMetadataRecord(queryC)
      })

      it('replies with an array of queries', async () => {
        const response = await server.inject({
          headers: { authorization: `Bearer ${createSortJwt(userA.id)}` },
          method: 'GET',
          url: `/v2/orgs/${orgA.slug}/queries`
        })

        expect(response.statusCode).toBe(200)

        const body = response.json()
        expect(body).toEqual({
          type: 'list_queries',
          payload: {
            queries: expect.arrayContaining([
              {
                id: expect.any(String),
                created_at: expect.stringMatching(iso8601RegExp),
                updated_at: expect.stringMatching(iso8601RegExp),
                name: expect.stringMatching(iso8601RegExp),
                description: queryA.query.description,
                type: queryA.query.type,
                intent: null,
                sql: queryA.query.sql,
                org_slug: orgA.slug,
                database_name: queryA.databaseName,
                database_slug: expect.stringMatching(
                  new RegExp(`^${queryA.databaseName}-.+`)
                ),
                connection_id: queryA.connectionId,
                created_by: userA.id,
                created_by_name: userA.name,
                created_by_picture: userA.picture,
                created_by_username: userA.username
              },
              {
                id: expect.any(String),
                created_at: expect.stringMatching(iso8601RegExp),
                updated_at: expect.stringMatching(iso8601RegExp),
                name: queryB.query.name,
                description: queryB.query.description,
                type: queryB.query.type,
                intent: queryB.query.intent,
                sql: null,
                org_slug: orgA.slug,
                database_name: queryB.databaseName,
                database_slug: expect.stringMatching(
                  new RegExp(`^${queryB.databaseName}-.+`)
                ),
                connection_id: queryB.connectionId,
                created_by: userB.id,
                created_by_name: userB.name,
                created_by_picture: userB.picture,
                created_by_username: userB.username
              }
            ])
          }
        })
        expect(body.payload.queries).toHaveLength(2)
      })

      describe('when database_slug querystring option exists', () => {
        it('replies with queries from the matching database', async () => {
          const dbSlug = await getDbSlug({
            connectionId: conn1.id,
            databaseRawName: 'sort_xyz'
          })

          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
            method: 'GET',
            url: `/v2/orgs/${org1.slug}/queries?database_slug=${dbSlug}`
          })

          const body = response.json()
          expect(body).toEqual({
            type: 'list_queries',
            payload: {
              queries: expect.arrayContaining([
                {
                  id: expect.any(String),
                  created_at: expect.any(String),
                  updated_at: expect.any(String),
                  name: queryE.query.name,
                  intent: null,
                  description: queryE.query.description,
                  type: queryE.query.type,
                  sql: queryE.query.sql,
                  org_slug: org1.slug,
                  database_name: queryE.databaseName,
                  database_slug: expect.stringMatching(
                    new RegExp(`^${queryE.databaseName}-.+`)
                  ),
                  connection_id: queryE.connectionId,
                  created_by: user1.id,
                  created_by_name: user1.name,
                  created_by_picture: user1.picture,
                  created_by_username: user1.username
                }
              ])
            }
          })
          expect(body.payload.queries).toHaveLength(1)
          expect(response.statusCode).toBe(200)
        })

        it('replies with 404 for a non-existent database', async () => {
          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
            method: 'GET',
            url: `/v2/orgs/${org1.slug}/queries?database_slug=missing`
          })

          expect(response.statusCode).toBe(404)
        })
      })

      describe('when user is not a member of the org', () => {
        it('replies with public queries only', async () => {
          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(userB.id)}` },
            method: 'GET',
            url: `/v2/orgs/${orgA.slug}/queries`
          })

          const body = response.json()
          expect(body).toEqual({
            type: 'list_queries',
            payload: {
              queries: expect.arrayContaining([
                {
                  id: expect.any(String),
                  created_at: expect.any(String),
                  updated_at: expect.any(String),
                  name: queryB.query.name,
                  description: queryB.query.description,
                  type: queryB.query.type,
                  intent: queryB.query.intent,
                  sql: null,
                  org_slug: orgA.slug,
                  database_name: queryB.databaseName,
                  database_slug: expect.stringMatching(
                    new RegExp(`^${queryB.databaseName}-.+`)
                  ),
                  connection_id: queryB.connectionId,
                  created_by: userB.id,
                  created_by_name: userB.name,
                  created_by_picture: userB.picture,
                  created_by_username: userB.username
                }
              ])
            }
          })

          for (const query of body.payload.queries) {
            expect(query.connection_id).not.toEqual(connA.id)
            expect(query.connection_id).not.toEqual(connB.id)
          }

          expect(response.statusCode).toBe(200)
        })
      })
    })
  })

  describe('GET /v2/orgs/:org_slug/queries/:query_id', () => {
    testInvalidSortAuthHeaders({
      method: 'GET',
      url: `/v2/orgs/${org1.slug}/queries/${randomUUID()}`
    })

    describe('when no query exists', () => {
      it('replies with HTTP 404', async () => {
        const response = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(user1.id)}`
          },
          method: 'GET',
          url: `/v2/orgs/${org1.slug}/queries/${randomUUID()}`
        })

        expect(response.statusCode).toBe(404)
        expect(response.json()).toEqual({
          type: 'error',
          payload: {
            error: {
              message: 'Query not found.'
            }
          }
        })
      })
    })

    describe('when query exists', () => {
      const userA = userMock.create()
      const orgA = orgMock.create({ created_by: userA.id })
      const privateConn = connMock.create({
        organization_id: orgA.id,
        created_by: userA.id
      })
      const publicConn = connMock.create({
        organization_id: orgA.id,
        created_by: userA.id,
        visibility: 'public'
      })
      const privateQuery = {
        userId: userA.id,
        databaseName: 'wonka',
        connectionId: privateConn.id,
        query: {
          name: 'my query',
          type: 'sql',
          sql: 'select * from my.table'
        }
      } satisfies QueryStorageService.QueryArg
      const publicQuery = {
        userId: userA.id,
        databaseName: 'public-wonka',
        connectionId: publicConn.id,
        query: {
          name: 'my public query',
          type: 'sql',
          sql: 'select * from my.public.table'
        }
      } satisfies QueryStorageService.QueryArg

      let existingPrivateQuery: Awaited<
        ReturnType<typeof QueryStorageService.insert>
      >
      let existingPublicQuery: Awaited<
        ReturnType<typeof QueryStorageService.insert>
      >

      beforeAll(async () => {
        await UserService.createUser(userA)
        await OrganizationService.create(orgA)
        await ConnectionService.create(privateConn)
        await ConnectionService.create(publicConn)

        existingPrivateQuery = await QueryStorageService.insert(privateQuery)
        existingPublicQuery = await QueryStorageService.insert(publicQuery)

        await MetadataDatabaseService.insertMetadataDb(KyselyService.getDb(), {
          connection_id: privateConn.id,
          organization_id: privateConn.organization_id,
          raw_name: privateQuery.databaseName,
          slug: `${privateQuery.databaseName}-private`
        })

        await MetadataDatabaseService.insertMetadataDb(KyselyService.getDb(), {
          connection_id: publicConn.id,
          organization_id: publicConn.organization_id,
          raw_name: publicQuery.databaseName,
          slug: `${publicQuery.databaseName}-public`
        })
      })

      describe('when user is a member of the org', () => {
        it('replies with the query', async () => {
          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(userA.id)}` },
            method: 'GET',
            url: `/v2/orgs/${orgA.slug}/queries/${existingPrivateQuery.id}`
          })

          expect(response.json()).toEqual({
            type: 'get_query',
            payload: {
              query: {
                id: existingPrivateQuery.id,
                created_at: expect.any(String),
                updated_at: expect.any(String),
                type: privateQuery.query.type,
                intent: null,
                sql: privateQuery.query.sql,
                name: privateQuery.query.name,
                description: null,
                org_slug: orgA.slug,
                database_name: privateQuery.databaseName,
                database_slug: expect.stringMatching(
                  new RegExp(`^${privateQuery.databaseName}-.+`)
                ),
                connection_id: privateQuery.connectionId,
                created_by: userA.id,
                created_by_name: userA.name,
                created_by_picture: userA.picture,
                created_by_username: userA.username
              }
            }
          })
          expect(response.statusCode).toBe(200)
        })
      })

      describe('when connection.visibility is private', () => {
        describe('when user is not a member of the org', () => {
          it('replies with HTTP 404', async () => {
            const response = await server.inject({
              headers: {
                authorization: `Bearer ${createSortJwt(user2.id)}`
              },
              method: 'GET',
              url: `/v2/orgs/${orgA.slug}/queries/${existingPrivateQuery.id}`
            })

            expect(response.statusCode).toBe(404)
            expect(response.json()).toEqual({
              type: 'error',
              payload: {
                error: {
                  message: 'Query not found.'
                }
              }
            })
          })
        })
      })

      describe('when connection.visibility is public', () => {
        describe('when user is not a member of the org', () => {
          it('replies with the query', async () => {
            const response = await server.inject({
              headers: { authorization: `Bearer ${createSortJwt(user2.id)}` },
              method: 'GET',
              url: `/v2/orgs/${orgA.slug}/queries/${existingPublicQuery.id}`
            })

            expect(response.json()).toEqual({
              type: 'get_query',
              payload: {
                query: {
                  id: existingPublicQuery.id,
                  created_at: expect.any(String),
                  updated_at: expect.any(String),
                  type: publicQuery.query.type,
                  intent: null,
                  sql: publicQuery.query.sql,
                  name: publicQuery.query.name,
                  description: null,
                  org_slug: orgA.slug,
                  database_name: publicQuery.databaseName,
                  database_slug: expect.stringMatching(
                    new RegExp(`^${publicQuery.databaseName}-.+`)
                  ),
                  connection_id: publicQuery.connectionId,
                  created_by: userA.id,
                  created_by_name: userA.name,
                  created_by_picture: userA.picture,
                  created_by_username: userA.username
                }
              }
            })
            expect(response.statusCode).toBe(200)
          })
        })
      })
    })
  })

  describe('PATCH /v2/orgs/:org_slug/queries/:query_id', () => {
    testInvalidSortAuthHeaders({
      method: 'PATCH',
      url: `/v2/orgs/${org1.slug}/queries/${randomUUID()}`
    })

    describe('when no query exists', () => {
      it('replies with HTTP 404', async () => {
        const response = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(user1.id)}`
          },
          method: 'PATCH',
          url: `/v2/orgs/${org1.slug}/queries/${randomUUID()}`,
          body: {
            query: { name: 'changed' }
          }
        })

        expect(response.statusCode).toBe(404)
        expect(response.json()).toEqual({
          type: 'error',
          payload: {
            error: {
              message: 'Query not found.'
            }
          }
        })
      })
    })

    describe('when query exists', () => {
      const userA = userMock.create()
      const userB = userMock.create()
      const orgA = orgMock.create({ created_by: userA.id })
      const connA = connMock.create({
        organization_id: orgA.id,
        created_by: userA.id
      })
      const connB = connMock.create({
        organization_id: orgA.id,
        created_by: userA.id
      })
      const queryA = {
        userId: userA.id,
        databaseName: 'wonka',
        connectionId: connA.id,
        query: {
          type: 'sql',
          sql: 'select * from my.table'
        }
      } satisfies QueryStorageService.QueryArg

      let existingQuery: Awaited<ReturnType<typeof QueryStorageService.insert>>
      beforeAll(async () => {
        await UserService.createUser(userA)
        await UserService.createUser(userB)
        await OrganizationService.create(orgA)
        await OrganizationService.addMember(orgA.slug, userB.id, 'member')
        await ConnectionService.create(connA)
        await ConnectionService.create(connB)

        const log = createFastifyMockLogger()
        const importer = createSchemaImporter(connB)
        snapshotMock.push(await importer.importSchema(userA.id, log))

        existingQuery = await QueryStorageService.insert(queryA)
      }, 10000)

      describe('when user is not the owner of the query', () => {
        it('replies with 404', async () => {
          const response = await server.inject({
            headers: {
              authorization: `Bearer ${createSortJwt(userB.id)}`
            },
            method: 'PATCH',
            url: `/v2/orgs/${orgA.slug}/queries/${existingQuery.id}`,
            body: {
              query: { name: 'something-else' }
            }
          })

          expect(response.statusCode).toBe(404)
          expect(response.json()).toEqual({
            type: 'error',
            payload: {
              error: {
                message: 'Query not found.'
              }
            }
          })
        })
      })

      describe('when user is the owner of the query', () => {
        it('updates and replies with the query', async () => {
          const newDbName = 'sort_xyz'
          const newConnId = connB.id
          const dbSlug = await getDbSlug({
            connectionId: newConnId,
            databaseRawName: newDbName
          })
          const newQuery = {
            name: 'my name',
            description: 'my description',
            type: 'intent',
            intent: {
              dml: 'SELECT',
              schema: 'public',
              table: 'user',
              columns: ['name'],
              combinator: 'AND',
              filters: [],
              orders: [],
              limit: 10
            }
          }

          const response = await server.inject({
            headers: {
              authorization: `Bearer ${createSortJwt(userA.id)}`
            },
            method: 'PATCH',
            url: `/v2/orgs/${orgA.slug}/queries/${existingQuery.id}`,
            body: {
              database_slug: dbSlug,
              query: newQuery
            }
          })

          expect(response.statusCode).toBe(200)
          expect(response.json()).toEqual({
            type: 'update_query',
            payload: {
              query: expect.objectContaining({
                id: existingQuery.id,
                created_at: expect.any(String),
                updated_at: expect.not.stringMatching(
                  existingQuery.updated_at.toISOString()
                ),
                created_by: userA.id,
                type: newQuery.type,
                intent: newQuery.intent,
                sql: null,
                database_name: newDbName,
                connection_id: newConnId,
                name: newQuery.name,
                description: newQuery.description
              })
            }
          })
        })
      })

      describe('when user is not a member of the org', () => {
        it('replies with HTTP 404', async () => {
          const response = await server.inject({
            headers: {
              authorization: `Bearer ${createSortJwt(userA.id)}`
            },
            method: 'PATCH',
            url: `/v2/orgs/${org2.slug}/queries/${existingQuery.id}`,
            body: {
              query: { name: 'something-else' }
            }
          })

          expect(response.json()).toEqual({
            type: 'error',
            payload: {
              error: {
                message: 'Query not found.'
              }
            }
          })
          expect(response.statusCode).toBe(404)
        })
      })
    })
  })

  describe('DELETE /v2/orgs/:org_slug/queries/:query_id', () => {
    testInvalidSortAuthHeaders({
      method: 'DELETE',
      url: `/v2/orgs/${org1.slug}/queries/${randomUUID()}`
    })

    const userA = userMock.create()
    const userB = userMock.create()
    const orgA = orgMock.create({ created_by: userA.id })
    const orgB = orgMock.create({ created_by: userB.id })
    const connA = connMock.create({
      organization_id: orgA.id,
      created_by: userA.id
    })
    const connB = connMock.create({
      organization_id: orgB.id,
      created_by: userB.id
    })
    const connC = connMock.create({
      organization_id: orgB.id,
      created_by: userB.id,
      visibility: 'public'
    })

    const queryA = {
      userId: userA.id,
      databaseName: 'sort_xyz',
      connectionId: connA.id,
      query: {
        type: 'sql',
        sql: 'select * from my.table'
      }
    } satisfies QueryStorageService.QueryArg

    const queryB = {
      userId: userB.id,
      databaseName: 'sort_xyz',
      connectionId: connB.id,
      query: {
        type: 'sql',
        sql: 'select credits from other.table'
      }
    } satisfies QueryStorageService.QueryArg

    let existingQueryA: Awaited<ReturnType<typeof QueryStorageService.insert>>
    let existingQueryB: Awaited<ReturnType<typeof QueryStorageService.insert>>
    beforeAll(async () => {
      await UserService.createUser(userA)
      await UserService.createUser(userB)
      await OrganizationService.create(orgA)
      await OrganizationService.addMember(orgA.slug, userB.id, 'member')
      await OrganizationService.create(orgB)
      await ConnectionService.create(connA)
      await ConnectionService.create(connB)
      await ConnectionService.create(connC)
      existingQueryA = await QueryStorageService.insert(queryA)
      existingQueryB = await QueryStorageService.insert(queryB)
    })

    describe('when user is not a member of the org', () => {
      it('replies with HTTP 404', async () => {
        const response = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(userA.id)}`
          },
          method: 'DELETE',
          url: `/v2/orgs/${orgB.slug}/queries/${existingQueryB.id}`
        })

        expect(response.statusCode).toBe(404)
        expect(response.json()).toEqual({
          type: 'error',
          payload: {
            error: {
              message: 'Query not found.'
            }
          }
        })
      })
    })

    describe('when user is not the owner of the query', () => {
      it('replies with HTTP 404', async () => {
        const response = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(userB.id)}`
          },
          method: 'DELETE',
          url: `/v2/orgs/${orgA.slug}/queries/${existingQueryA.id}`
        })

        expect(response.statusCode).toBe(404)
        expect(response.json()).toEqual({
          type: 'error',
          payload: {
            error: {
              message: 'Query not found.'
            }
          }
        })
      })
    })

    describe('when user is the owner of the query', () => {
      it('deletes the query', async () => {
        const response = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(userA.id)}`
          },
          method: 'DELETE',
          url: `/v2/orgs/${orgA.slug}/queries/${existingQueryA.id}`
        })

        expect(response.statusCode).toBe(200)
        expect(response.json()).toEqual({
          type: 'success',
          payload: {
            success: {
              message: `Query ${existingQueryA.id} deleted successfully.`
            }
          }
        })
      })
    })

    describe('when the query does not exist', () => {
      it('replies with HTTP 404', async () => {
        const response = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(userA.id)}`
          },
          method: 'DELETE',
          url: `/v2/orgs/${orgA.slug}/queries/${randomUUID()}`
        })

        expect(response.statusCode).toBe(404)
        expect(response.json()).toEqual({
          type: 'error',
          payload: {
            error: {
              message: 'Query not found.'
            }
          }
        })
      })
    })
  })
})
