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
import { getTestServer } from '../../global/utils/test.util'
import { createFastifyMockLogger } from '../mocks/fastify-logger.mock'
import { createSortJwt } from '../utils/jwt.util'
import { testInvalidSortAuthHeaders } from '../utils/test.util'

import type { FastifyInstance } from 'fastify'

describe('v2/routes/search.route', () => {
  const userMock = new UserMock()
  const user = userMock.create()
  const orgMock = new OrganizationMock()
  const org = orgMock.create({ created_by: user.id })
  const connMock = new ConnectionMock()
  const conn = connMock.create({
    organization_id: org.id,
    created_by: user.id
  })

  let server: FastifyInstance
  let snapshotId: string | null = null

  beforeAll(async () => {
    server = await getTestServer()
    createKysely()
    await UserService.createUser(user)
    await OrganizationService.create(org)
    await ConnectionService.create(conn)

    const schemaImporter = createSchemaImporter(conn)
    const log = createFastifyMockLogger()
    snapshotId = await schemaImporter.importSchema(user.id, log)
    await new Promise(resolve => setTimeout(resolve, 2000))
  }, 10000)

  afterAll(async () => {
    await getDb().deleteFrom('snapshot').where('id', '=', snapshotId).execute()
    await connMock.removeAll()
    await getDb()
      .deleteFrom('organization_user')
      .where('user_id', '=', user.id)
      .execute()
    await orgMock.removeAll()
    await userMock.removeAll()
    await disconnectKysely()
  })

  describe('GET /v2/search', () => {
    testInvalidSortAuthHeaders({
      method: 'GET',
      url: '/v2/search'
    })

    describe('when results exist', () => {
      describe('when not using scopes', () => {
        it('replies with matching results', async () => {
          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
            method: 'GET',
            url: '/v2/search',
            query: { q: `sort_xyz OR "${org.name}" OR connections` }
          })

          expect(response.statusCode).toBe(200)

          const body = response.json()
          expect(body).toEqual({
            type: 'search',
            payload: {
              results: {
                organizations: expect.arrayContaining([
                  expect.objectContaining({
                    org_name: org.name,
                    org_slug: org.slug
                  })
                ]),
                databases: expect.arrayContaining([
                  expect.objectContaining({
                    connection_id: conn.id,
                    connection_name: conn.name,
                    db_name: 'sort_xyz',
                    db_name_raw: 'sort_xyz',
                    db_slug: expect.stringMatching(/^sort_xyz-/),
                    org_name: org.name,
                    org_slug: org.slug
                  })
                ]),
                tables: expect.arrayContaining([
                  expect.objectContaining({
                    connection_id: conn.id,
                    connection_name: conn.name,
                    db_name: 'sort_xyz',
                    db_name_raw: 'sort_xyz',
                    db_slug: expect.stringMatching(/^sort_xyz-/),
                    org_name: org.name,
                    org_slug: org.slug,
                    schema_name: 'public',
                    schema_name_raw: 'public',
                    table_name: 'connection',
                    table_name_raw: 'connection'
                  })
                ])
              }
            }
          })
        })
      })

      describe('when using schema: scope', () => {
        describe('without terms', () => {
          it('replies with results', async () => {
            const response = await server.inject({
              headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
              method: 'GET',
              url: '/v2/search',
              query: { q: 'schema:public' }
            })

            expect(response.statusCode).toBe(200)

            const body = response.json()
            expect(body).toEqual({
              type: 'search',
              payload: {
                results: {
                  organizations: [],
                  databases: expect.arrayContaining([
                    {
                      connection_id: conn.id,
                      connection_name: conn.name,
                      db_name: 'sort_xyz',
                      db_name_raw: 'sort_xyz',
                      db_slug: expect.stringMatching(/^sort_xyz-/),
                      org_name: org.name,
                      org_slug: org.slug
                    }
                  ]),
                  tables: expect.arrayContaining([
                    expect.objectContaining({
                      connection_id: conn.id,
                      connection_name: conn.name,
                      db_name: 'sort_xyz',
                      db_name_raw: 'sort_xyz',
                      db_slug: expect.stringMatching(/^sort_xyz-/),
                      org_name: org.name,
                      org_slug: org.slug,
                      schema_name: 'public',
                      schema_name_raw: 'public',
                      table_name: expect.any(String),
                      table_name_raw: expect.any(String)
                    })
                  ])
                }
              }
            })
          })
        })

        describe('with terms', () => {
          it('replies with matching results', async () => {
            const response = await server.inject({
              headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
              method: 'GET',
              url: '/v2/search',
              query: { q: 'schema:public metadata -nft' }
            })

            expect(response.statusCode).toBe(200)

            const body = response.json()
            expect(body).toEqual({
              type: 'search',
              payload: {
                results: {
                  organizations: [],
                  databases: [],
                  tables: expect.arrayContaining([
                    {
                      connection_id: conn.id,
                      connection_name: conn.name,
                      db_name: 'sort_xyz',
                      db_name_raw: 'sort_xyz',
                      db_slug: expect.stringMatching(/^sort_xyz-/),
                      org_name: org.name,
                      org_slug: org.slug,
                      schema_name: 'public',
                      schema_name_raw: 'public',
                      table_name: 'metadata_table',
                      table_name_raw: 'metadata_table'
                    },
                    {
                      connection_id: conn.id,
                      connection_name: conn.name,
                      db_name: 'sort_xyz',
                      db_name_raw: 'sort_xyz',
                      db_slug: expect.stringMatching(/^sort_xyz-/),
                      org_name: org.name,
                      org_slug: org.slug,
                      schema_name: 'public',
                      schema_name_raw: 'public',
                      table_name: 'metadata_database',
                      table_name_raw: 'metadata_database'
                    }
                  ])
                }
              }
            })
          })
        })
      })

      describe('when using db: scope', () => {
        describe('without terms', () => {
          it('replies with matching results', async () => {
            const response = await server.inject({
              headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
              method: 'GET',
              url: '/v2/search',
              query: { q: 'db:sort_xyz' }
            })

            expect(response.statusCode).toBe(200)

            const body = response.json()
            expect(body).toEqual({
              type: 'search',
              payload: {
                results: {
                  organizations: [],
                  databases: expect.arrayContaining([
                    expect.objectContaining({
                      connection_id: conn.id,
                      connection_name: conn.name,
                      db_name: 'sort_xyz',
                      db_name_raw: 'sort_xyz',
                      db_slug: expect.stringMatching(/^sort_xyz-/),
                      org_name: org.name,
                      org_slug: org.slug
                    })
                  ]),
                  tables: expect.arrayContaining([
                    expect.objectContaining({
                      connection_id: conn.id,
                      connection_name: conn.name,
                      db_name: 'sort_xyz',
                      db_name_raw: 'sort_xyz',
                      db_slug: expect.stringMatching(/^sort_xyz-/),
                      org_name: org.name,
                      org_slug: org.slug,
                      schema_name: expect.stringMatching(
                        /public|ethereum|polygon|goerli/
                      ),
                      schema_name_raw: expect.stringMatching(
                        /public|ethereum|polygon|goerli/
                      ),
                      table_name: expect.any(String),
                      table_name_raw: expect.any(String)
                    }),
                    expect.objectContaining({
                      connection_id: conn.id,
                      connection_name: conn.name,
                      db_name: 'sort_xyz',
                      db_name_raw: 'sort_xyz',
                      db_slug: expect.stringMatching(/^sort_xyz-/),
                      org_name: org.name,
                      org_slug: org.slug,
                      schema_name: expect.stringMatching(
                        /public|ethereum|polygon|goerli/
                      ),
                      schema_name_raw: expect.stringMatching(
                        /public|ethereum|polygon|goerli/
                      ),
                      table_name: expect.any(String),
                      table_name_raw: expect.any(String)
                    }),
                    expect.objectContaining({
                      connection_id: conn.id,
                      connection_name: conn.name,
                      db_name: 'sort_xyz',
                      db_name_raw: 'sort_xyz',
                      db_slug: expect.stringMatching(/^sort_xyz-/),
                      org_name: org.name,
                      org_slug: org.slug,
                      schema_name: expect.stringMatching(
                        /public|ethereum|polygon|goerli/
                      ),
                      schema_name_raw: expect.stringMatching(
                        /public|ethereum|polygon|goerli/
                      ),
                      table_name: expect.any(String),
                      table_name_raw: expect.any(String)
                    }),
                    expect.objectContaining({
                      connection_id: conn.id,
                      connection_name: conn.name,
                      db_name: 'sort_xyz',
                      db_name_raw: 'sort_xyz',
                      db_slug: expect.stringMatching(/^sort_xyz-/),
                      org_name: org.name,
                      org_slug: org.slug,
                      schema_name: expect.stringMatching(
                        /public|ethereum|polygon|goerli/
                      ),
                      schema_name_raw: expect.stringMatching(
                        /public|ethereum|polygon|goerli/
                      ),
                      table_name: expect.any(String),
                      table_name_raw: expect.any(String)
                    }),
                    expect.objectContaining({
                      connection_id: conn.id,
                      connection_name: conn.name,
                      db_name: 'sort_xyz',
                      db_name_raw: 'sort_xyz',
                      db_slug: expect.stringMatching(/^sort_xyz-/),
                      org_name: org.name,
                      org_slug: org.slug,
                      schema_name: expect.stringMatching(
                        /public|ethereum|polygon|goerli/
                      ),
                      schema_name_raw: expect.stringMatching(
                        /public|ethereum|polygon|goerli/
                      ),
                      table_name: expect.any(String),
                      table_name_raw: expect.any(String)
                    })
                  ])
                }
              }
            })
          })
        })

        describe('with terms', () => {
          it('replies with matching results', async () => {
            const response = await server.inject({
              headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
              method: 'GET',
              url: '/v2/search',
              query: { q: ` table OR ${org.name} db:sort_xyz` }
            })

            expect(response.statusCode).toBe(200)

            const body = response.json()
            expect(body).toEqual({
              type: 'search',
              payload: {
                results: {
                  organizations: [
                    {
                      org_name: org.name,
                      org_slug: org.slug
                    }
                  ],
                  databases: [],
                  tables: expect.arrayContaining([
                    {
                      connection_id: conn.id,
                      connection_name: conn.name,
                      db_name: 'sort_xyz',
                      db_name_raw: 'sort_xyz',
                      db_slug: expect.stringMatching(/^sort_xyz-/),
                      org_name: org.name,
                      org_slug: org.slug,
                      schema_name: 'public',
                      schema_name_raw: 'public',
                      table_name: 'metadata_table',
                      table_name_raw: 'metadata_table'
                    },
                    {
                      connection_id: conn.id,
                      connection_name: conn.name,
                      db_name: 'sort_xyz',
                      db_name_raw: 'sort_xyz',
                      db_slug: expect.stringMatching(/^sort_xyz-/),
                      org_name: org.name,
                      org_slug: org.slug,
                      schema_name: 'public',
                      schema_name_raw: 'public',
                      table_name: 'snapshot_table',
                      table_name_raw: 'snapshot_table'
                    }
                  ])
                }
              }
            })
          })
        })
      })

      describe('when using org: scope', () => {
        describe('without terms', () => {
          it('replies with matching results', async () => {
            const response = await server.inject({
              headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
              method: 'GET',
              url: '/v2/search',
              query: { q: ` org:"${org.name}" ` }
            })

            expect(response.statusCode).toBe(200)

            const body = response.json()
            expect(body).toEqual({
              type: 'search',
              payload: {
                results: {
                  organizations: [
                    {
                      org_name: org.name,
                      org_slug: org.slug
                    }
                  ],
                  databases: expect.arrayContaining([
                    {
                      connection_id: conn.id,
                      connection_name: conn.name,
                      db_name: 'sort_xyz',
                      db_name_raw: 'sort_xyz',
                      db_slug: expect.stringMatching(/^sort_xyz-/),
                      org_name: org.name,
                      org_slug: org.slug
                    }
                  ]),
                  tables: expect.arrayContaining([
                    expect.objectContaining({
                      connection_id: conn.id,
                      connection_name: conn.name,
                      db_name: 'sort_xyz',
                      db_name_raw: 'sort_xyz',
                      db_slug: expect.stringMatching(/^sort_xyz-/),
                      org_name: org.name,
                      org_slug: org.slug,
                      schema_name: expect.stringMatching(
                        /public|ethereum|polygon|goerli/
                      ),
                      schema_name_raw: expect.stringMatching(
                        /public|ethereum|polygon|goerli/
                      ),
                      table_name: expect.any(String),
                      table_name_raw: expect.any(String)
                    }),
                    expect.objectContaining({
                      connection_id: conn.id,
                      connection_name: conn.name,
                      db_name: 'sort_xyz',
                      db_name_raw: 'sort_xyz',
                      db_slug: expect.stringMatching(/^sort_xyz-/),
                      org_name: org.name,
                      org_slug: org.slug,
                      schema_name: expect.stringMatching(
                        /public|ethereum|polygon|goerli/
                      ),
                      schema_name_raw: expect.stringMatching(
                        /public|ethereum|polygon|goerli/
                      ),
                      table_name: expect.any(String),
                      table_name_raw: expect.any(String)
                    }),
                    expect.objectContaining({
                      connection_id: conn.id,
                      connection_name: conn.name,
                      db_name: 'sort_xyz',
                      db_name_raw: 'sort_xyz',
                      db_slug: expect.stringMatching(/^sort_xyz-/),
                      org_name: org.name,
                      org_slug: org.slug,
                      schema_name: expect.stringMatching(
                        /public|ethereum|polygon|goerli/
                      ),
                      schema_name_raw: expect.stringMatching(
                        /public|ethereum|polygon|goerli/
                      ),
                      table_name: expect.any(String),
                      table_name_raw: expect.any(String)
                    }),
                    expect.objectContaining({
                      connection_id: conn.id,
                      connection_name: conn.name,
                      db_name: 'sort_xyz',
                      db_name_raw: 'sort_xyz',
                      db_slug: expect.stringMatching(/^sort_xyz-/),
                      org_name: org.name,
                      org_slug: org.slug,
                      schema_name: expect.stringMatching(
                        /public|ethereum|polygon|goerli/
                      ),
                      schema_name_raw: expect.stringMatching(
                        /public|ethereum|polygon|goerli/
                      ),
                      table_name: expect.any(String),
                      table_name_raw: expect.any(String)
                    }),
                    expect.objectContaining({
                      connection_id: conn.id,
                      connection_name: conn.name,
                      db_name: 'sort_xyz',
                      db_name_raw: 'sort_xyz',
                      db_slug: expect.stringMatching(/^sort_xyz-/),
                      org_name: org.name,
                      org_slug: org.slug,
                      schema_name: expect.stringMatching(
                        /public|ethereum|polygon|goerli/
                      ),
                      schema_name_raw: expect.stringMatching(
                        /public|ethereum|polygon|goerli/
                      ),
                      table_name: expect.any(String),
                      table_name_raw: expect.any(String)
                    })
                  ])
                }
              }
            })
          })
        })

        describe('with terms', () => {
          it('replies with matching results', async () => {
            const response = await server.inject({
              headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
              method: 'GET',
              url: '/v2/search',
              query: { q: `sort_xyz org:"${org.name}" ` }
            })

            expect(response.statusCode).toBe(200)

            const body = response.json()
            expect(body).toEqual({
              type: 'search',
              payload: {
                results: {
                  organizations: [],
                  databases: [
                    {
                      connection_id: conn.id,
                      connection_name: conn.name,
                      db_name: 'sort_xyz',
                      db_name_raw: 'sort_xyz',
                      db_slug: expect.stringMatching(/^sort_xyz-/),
                      org_name: org.name,
                      org_slug: org.slug
                    }
                  ],
                  tables: []
                }
              }
            })
          })
        })
      })

      describe('when using multiple scopes', () => {
        it('replies with matching results', async () => {
          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
            method: 'GET',
            url: '/v2/search',
            query: { q: ` db:sort_xyz    org:"${org.name}"` }
          })

          expect(response.statusCode).toBe(200)

          const body = response.json()
          expect(body).toEqual({
            type: 'search',
            payload: {
              results: {
                organizations: [
                  {
                    org_name: org.name,
                    org_slug: org.slug
                  }
                ],
                databases: [
                  {
                    connection_id: conn.id,
                    connection_name: conn.name,
                    db_name: 'sort_xyz',
                    db_name_raw: 'sort_xyz',
                    db_slug: expect.stringMatching(/^sort_xyz-/),
                    org_name: org.name,
                    org_slug: org.slug
                  }
                ],
                tables: expect.arrayContaining([
                  expect.objectContaining({
                    connection_id: conn.id,
                    connection_name: conn.name,
                    db_name: 'sort_xyz',
                    db_name_raw: 'sort_xyz',
                    db_slug: expect.stringMatching(/^sort_xyz-/),
                    org_name: org.name,
                    org_slug: org.slug,
                    schema_name: expect.stringMatching(
                      /public|ethereum|polygon|goerli/
                    ),
                    schema_name_raw: expect.stringMatching(
                      /public|ethereum|polygon|goerli/
                    ),
                    table_name: expect.any(String),
                    table_name_raw: expect.any(String)
                  }),
                  expect.objectContaining({
                    connection_id: conn.id,
                    connection_name: conn.name,
                    db_name: 'sort_xyz',
                    db_name_raw: 'sort_xyz',
                    db_slug: expect.stringMatching(/^sort_xyz-/),
                    org_name: org.name,
                    org_slug: org.slug,
                    schema_name: expect.stringMatching(
                      /public|ethereum|polygon|goerli/
                    ),
                    schema_name_raw: expect.stringMatching(
                      /public|ethereum|polygon|goerli/
                    ),
                    table_name: expect.any(String),
                    table_name_raw: expect.any(String)
                  }),
                  expect.objectContaining({
                    connection_id: conn.id,
                    connection_name: conn.name,
                    db_name: 'sort_xyz',
                    db_name_raw: 'sort_xyz',
                    db_slug: expect.stringMatching(/^sort_xyz-/),
                    org_name: org.name,
                    org_slug: org.slug,
                    schema_name: expect.stringMatching(
                      /public|ethereum|polygon|goerli/
                    ),
                    schema_name_raw: expect.stringMatching(
                      /public|ethereum|polygon|goerli/
                    ),
                    table_name: expect.any(String),
                    table_name_raw: expect.any(String)
                  }),
                  expect.objectContaining({
                    connection_id: conn.id,
                    connection_name: conn.name,
                    db_name: 'sort_xyz',
                    db_name_raw: 'sort_xyz',
                    db_slug: expect.stringMatching(/^sort_xyz-/),
                    org_name: org.name,
                    org_slug: org.slug,
                    schema_name: expect.stringMatching(
                      /public|ethereum|polygon|goerli/
                    ),
                    schema_name_raw: expect.stringMatching(
                      /public|ethereum|polygon|goerli/
                    ),
                    table_name: expect.any(String),
                    table_name_raw: expect.any(String)
                  }),
                  expect.objectContaining({
                    connection_id: conn.id,
                    connection_name: conn.name,
                    db_name: 'sort_xyz',
                    db_name_raw: 'sort_xyz',
                    db_slug: expect.stringMatching(/^sort_xyz-/),
                    org_name: org.name,
                    org_slug: org.slug,
                    schema_name: expect.stringMatching(
                      /public|ethereum|polygon|goerli/
                    ),
                    schema_name_raw: expect.stringMatching(
                      /public|ethereum|polygon|goerli/
                    ),
                    table_name: expect.any(String),
                    table_name_raw: expect.any(String)
                  })
                ])
              }
            }
          })
        })
      })

      describe('with limit', () => {
        describe('above the max', () => {
          it('rejects the request', async () => {
            const response = await server.inject({
              headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
              method: 'GET',
              url: '/v2/search',
              query: { q: 'db:sort_xyz schema:public', limit: '101' }
            })

            expect(response.statusCode).toBe(400)

            const body = response.json()
            expect(body).toEqual({
              type: 'validation_error',
              payload: {
                validation_error: {
                  context: 'querystring',
                  errors: {
                    query: {
                      limit: 'must be a number less than or equal to 100'
                    }
                  },
                  message:
                    'A validation error occurred when validating the querystring.'
                }
              }
            })
          })
        })

        describe('not set', () => {
          it('uses the default limit', async () => {
            const response = await server.inject({
              headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
              method: 'GET',
              url: '/v2/search',
              query: {
                q: 'db:sort_xyz schema:public'
              }
            })

            expect(response.statusCode).toBe(200)

            const body = response.json()
            expect(body.type).toEqual('search')
            expect(body.payload.results.organizations).toHaveLength(0)
            expect(body.payload.results.databases.length).toBeGreaterThan(0)
            expect(body.payload.results.tables).toHaveLength(5)
          })
        })

        describe('set to a value between 1 - maximum', () => {
          it('applies the limit', async () => {
            const response = await server.inject({
              headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
              method: 'GET',
              url: '/v2/search',
              query: { q: 'db:sort_xyz schema:public', limit: '10' }
            })

            expect(response.statusCode).toBe(200)

            const body = response.json()
            expect(body.type).toEqual('search')
            expect(body.payload.results.organizations).toHaveLength(0)
            expect(body.payload.results.databases.length).toBeGreaterThan(0)
            expect(body.payload.results.tables).toHaveLength(10)
          })
        })
      })
    })

    describe('when no results are found', () => {
      it('replies with empty arrays', async () => {
        const response = await server.inject({
          headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
          method: 'GET',
          url: '/v2/search',
          query: { q: 'asdfasdfasd9393939393939ffdsafa' }
        })

        expect(response.statusCode).toBe(200)

        const body = response.json()
        expect(body).toEqual({
          type: 'search',
          payload: {
            results: {
              organizations: [],
              databases: [],
              tables: []
            }
          }
        })
      })
    })
  })
})
