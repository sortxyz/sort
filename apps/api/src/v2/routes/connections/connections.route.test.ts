import { randomUUID } from 'node:crypto'

import { dateFormat } from '@sort/shared/constants/type-mask.constant'
import {
  ConnectionMock,
  postgresConnectionMock,
  snowflakeConnectionMockPartial
} from '@sort/shared/mocks/connection.mock'
import { organizationMock } from '@sort/shared/mocks/org.mock'
import { UserMock } from '@sort/shared/mocks/user.mock'
import * as ConnectionsService from '@sort/shared/services/connection.service'
import * as OrganizationService from '@sort/shared/services/org.service'
import * as ImportJobService from '@sort/shared/services/schema-import/job.service'
import * as UserService from '@sort/shared/services/user.service'
import { changeDatabaseOfConnectionString } from '@sort/shared/utils/connection.util'

import { config } from '../../../config/bootstrap'
import * as KyselyService from '../../../global/services/kysely.service'
import { getTestServer } from '../../../global/utils/test.util'
import { getAuthHeaders } from '../../utils/test.util'

import type { ConnectionSelectWithEncryption } from '@sort/shared/types/kysely/connection/connection.type'
import type { Visibility } from '@sort/shared/types/kysely.type'
import type { FastifyInstance } from 'fastify'

const authTypes = [{ name: 'authorization' }, { name: 'x-api-key' }]

const removeConnectionString = (conn: Record<string, unknown>) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { connection_string: ignored, ...clone } = conn
  return clone
}

const confirmSchemaImportJobExists = async (connectionId: string) => {
  const jobs = await ImportJobService.getPendingJobs(100)
  const connectionIds = jobs.map(job => job.connection_id)
  expect(connectionIds).toContain(connectionId)
}

describe('Connection Routes tests', () => {
  const userMock = new UserMock()
  const user1 = userMock.create()
  const user2 = userMock.create()
  const user3 = userMock.create()
  const connMock = new ConnectionMock()

  let snowflakeConnStr: string
  let snowflakeUser: string

  let server: FastifyInstance

  const organizationMock1 = {
    ...organizationMock,
    created_by: user1.id
  }

  const organizationMock2 = {
    ...organizationMock,
    id: randomUUID(),
    slug: 'organization-2',
    name: 'Organization 2',
    created_by: user2.id
  }

  let snowflakeConnectionMock1: ConnectionSelectWithEncryption
  let snowflakeConnectionMock2: ConnectionSelectWithEncryption
  const postgresConnectionMock1 = connMock.create({
    ...postgresConnectionMock,
    created_by: user1.id,
    organization_id: organizationMock1.id
  })
  const postgresConnectionMock2 = connMock.create({
    ...postgresConnectionMock,
    id: randomUUID(),
    created_by: user1.id,
    organization_id: organizationMock1.id,
    visibility: 'public'
  })

  const cleanUp = async () => {
    await KyselyService.getDb().deleteFrom('organization_user').execute()
    await KyselyService.getDb().deleteFrom('organization').execute()
    await KyselyService.getDb().deleteFrom('user_api_key').execute()
    await KyselyService.getDb().deleteFrom('connection').execute()
    await userMock.removeAll()
  }

  beforeAll(async () => {
    server = await getTestServer()
    KyselyService.createKysely()
    snowflakeConnStr = config.TEST_SNOWFLAKE_HYBRID_CONNECTION_STRING!

    snowflakeUser = config.TEST_SNOWFLAKE_HYBRID_USER!

    snowflakeConnectionMock1 = connMock.create({
      ...snowflakeConnectionMockPartial,
      id: randomUUID(),
      created_by: user1.id,
      organization_id: organizationMock1.id,
      connection_string: snowflakeConnStr
    })
    snowflakeConnectionMock2 = connMock.create({
      ...snowflakeConnectionMockPartial,
      connection_string: snowflakeConnStr,
      created_by: user2.id,
      organization_id: organizationMock2.id
    })
  })

  beforeEach(async () => {
    await cleanUp()

    await UserService.createUser(user1)
    await OrganizationService.create({ ...organizationMock1 })
    await UserService.createUser(user2)
    await UserService.createUser(user3)
    await OrganizationService.addMember(
      organizationMock1.slug,
      user3.id,
      'member'
    )
    await OrganizationService.create({ ...organizationMock2 })
    await ConnectionsService.create(postgresConnectionMock1)
    await ConnectionsService.create(postgresConnectionMock2)
    await ConnectionsService.create(snowflakeConnectionMock1)
    await ConnectionsService.create(snowflakeConnectionMock2)
  })

  afterEach(async () => {
    await cleanUp()
  })

  afterAll(async () => {
    await KyselyService.disconnectKysely()
  })

  const postgresConnectionMock1ConnectionUrl = new URL(
    postgresConnectionMock.connection_string
  )

  describe('GET /v2/orgs/:slug/connections', () => {
    describe.each(authTypes)('using $name auth', ({ name }) => {
      describe('when the organization does not exist', () => {
        it('should respond with HTTP 404', async () => {
          const headers = await getAuthHeaders(name, user1.id)

          const response = await server.inject({
            headers,
            method: 'GET',
            url: '/v2/orgs/invalid/connections'
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
          const headers = await getAuthHeaders(name, user2.id)

          const response = await server.inject({
            headers,
            method: 'GET',
            url: `/v2/orgs/${organizationMock1.slug}/connections`
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
        it('should return the connections with the given slug', async () => {
          const headers = await getAuthHeaders(name, user1.id)

          const response = await server.inject({
            headers,
            method: 'GET',
            url: `/v2/orgs/${organizationMock1.slug}/connections`
          })

          expect(response.statusCode).toBe(200)
          expect(response.json()).toEqual({
            type: 'list_connections',
            payload: {
              connections: [
                {
                  ...removeConnectionString(postgresConnectionMock1),
                  created_at: expect.stringMatching(dateFormat)
                },
                {
                  ...removeConnectionString(postgresConnectionMock2),
                  created_at: expect.stringMatching(dateFormat)
                },
                {
                  ...removeConnectionString(snowflakeConnectionMock1),
                  created_at: expect.stringMatching(dateFormat)
                }
              ]
            }
          })
        })
      })
    })
  })

  describe('GET /v2/orgs/:slug/connections/:id', () => {
    describe.each(authTypes)('using $name auth', ({ name }) => {
      describe('when the organization does not exist', () => {
        it('should respond with HTTP 404', async () => {
          const headers = await getAuthHeaders(name, user1.id)

          const response = await server.inject({
            headers,
            method: 'GET',
            url: `/v2/orgs/invalid/connections/${postgresConnectionMock.id}`
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
          const headers = await getAuthHeaders(name, user2.id)

          const response = await server.inject({
            headers,
            method: 'GET',
            url: `/v2/orgs/${organizationMock1.slug}/connections/${postgresConnectionMock.id}`
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
        describe('when the connection does not exist', () => {
          it('should respond with HTTP 404', async () => {
            const headers = await getAuthHeaders(name, user1.id)

            const slug = organizationMock1.slug
            const id = randomUUID()
            const url = `/v2/orgs/${slug}/connections/${id}`

            const response = await server.inject({
              headers,
              method: 'GET',
              url
            })

            expect(response.statusCode).toEqual(404)
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

        describe('when the connection exists', () => {
          it('should return the matching connection', async () => {
            const headers = await getAuthHeaders(name, user1.id)

            const response = await server.inject({
              headers,
              method: 'GET',
              url: `/v2/orgs/${organizationMock1.slug}/connections/${postgresConnectionMock.id}`
            })

            expect(response.statusCode).toBe(200)
            expect(response.json()).toEqual({
              type: 'get_connection',
              payload: {
                connection: {
                  ...removeConnectionString(postgresConnectionMock1),
                  created_at: expect.stringMatching(dateFormat)
                }
              }
            })
          })
        })
      })
    })
  })

  describe('POST /v2/orgs/:slug/connections', () => {
    describe.each(authTypes)('using $name auth', ({ name }) => {
      describe('when type is connection_string', () => {
        describe('when the organization does not exist', () => {
          it('should respond with HTTP 404', async () => {
            const headers = await getAuthHeaders(name, user1.id)

            const response = await server.inject({
              headers,
              method: 'POST',
              url: '/v2/orgs/organization-3/connections',
              payload: {
                type: 'connection_string',
                read_only: false,
                name: postgresConnectionMock1.name,
                data_provider: postgresConnectionMock1.data_provider,
                visibility: postgresConnectionMock1.visibility,
                connection_string:
                  await postgresConnectionMock1.connection_string.decrypt()
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

        describe('when the organization exists and the user exists but the user does not belong', () => {
          it('should respond with HTTP 404', async () => {
            const headers = await getAuthHeaders(name, user2.id)

            const response = await server.inject({
              headers,
              method: 'POST',
              url: `/v2/orgs/${organizationMock1.slug}/connections`,
              payload: {
                type: 'connection_string',
                read_only: false,
                name: postgresConnectionMock1.name,
                data_provider: postgresConnectionMock1.data_provider,
                visibility: postgresConnectionMock1.visibility,
                connection_string:
                  await postgresConnectionMock1.connection_string.decrypt()
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

        describe('when the user is not an owner of the organization', () => {
          it('should respond with HTTP 404', async () => {
            const headers = await getAuthHeaders(name, user3.id)

            const response = await server.inject({
              headers,
              method: 'POST',
              url: `/v2/orgs/${organizationMock1.slug}/connections`,
              payload: {
                type: 'connection_string',
                read_only: false,
                name: postgresConnectionMock1.name,
                data_provider: postgresConnectionMock1.data_provider,
                visibility: postgresConnectionMock1.visibility,
                connection_string:
                  await postgresConnectionMock1.connection_string.decrypt()
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

        describe('when the user is an owner of the organization', () => {
          it('should create and import the postgres connection', async () => {
            const headers = await getAuthHeaders(name, user1.id)

            const response = await server.inject({
              headers,
              method: 'POST',
              url: `/v2/orgs/${organizationMock1.slug}/connections`,
              payload: {
                type: 'connection_string',
                read_only: false,
                name: postgresConnectionMock1.name,
                data_provider: postgresConnectionMock1.data_provider,
                visibility: postgresConnectionMock1.visibility,
                connection_string:
                  await postgresConnectionMock1.connection_string.decrypt()
              }
            })

            const connResponse = response.json()
            expect(connResponse).toEqual({
              type: 'create_connection',
              payload: {
                connection: {
                  ...removeConnectionString(postgresConnectionMock1),
                  created_at: expect.stringMatching(dateFormat),
                  id: expect.any(String)
                }
              }
            })
            expect(response.statusCode).toBe(201)

            await confirmSchemaImportJobExists(
              connResponse.payload.connection.id
            )
          })

          it('should create and import a read-only postgres connection', async () => {
            const headers = await getAuthHeaders(name, user1.id)

            // parent connection
            const parentResponse = await server.inject({
              headers,
              method: 'POST',
              url: `/v2/orgs/${organizationMock1.slug}/connections`,
              payload: {
                type: 'connection_string',
                read_only: false,
                name: postgresConnectionMock1.name,
                data_provider: postgresConnectionMock1.data_provider,
                visibility: postgresConnectionMock1.visibility,
                connection_string:
                  await postgresConnectionMock1.connection_string.decrypt()
              }
            })

            expect(parentResponse.statusCode).toBe(201)

            const parentId = parentResponse.json().payload.connection.id

            await confirmSchemaImportJobExists(parentId)

            // readonly connection
            const readonlyResponse = await server.inject({
              headers,
              method: 'POST',
              url: `/v2/orgs/${organizationMock1.slug}/connections`,
              payload: {
                type: 'connection_string',
                read_only: true,
                parent_connection_id: parentId,
                data_provider: postgresConnectionMock1.data_provider,
                connection_string:
                  await postgresConnectionMock2.connection_string.decrypt()
              }
            })

            const connResponse = readonlyResponse.json()
            expect(connResponse).toEqual({
              type: 'create_connection',
              payload: {
                connection: {
                  ...removeConnectionString(postgresConnectionMock2),
                  visibility: 'private',
                  name: expect.stringMatching(/.*-readonly$/),
                  created_at: expect.stringMatching(dateFormat),
                  id: expect.any(String)
                }
              }
            })
            expect(readonlyResponse.statusCode).toBe(201)

            const updatedParent = await ConnectionsService.getById(parentId)
            expect(updatedParent).toEqual({
              ...removeConnectionString(postgresConnectionMock1),
              created_at: expect.any(Date),
              connection_string: expect.any(Object),
              name: postgresConnectionMock1.name,
              readonly_connection_id: connResponse.payload.connection.id,
              id: expect.any(String)
            })
          })

          it('should create and import the snowflake connection', async () => {
            const headers = await getAuthHeaders(name, user1.id)

            const response = await server.inject({
              headers,
              method: 'POST',
              url: `/v2/orgs/${organizationMock1.slug}/connections`,
              payload: {
                type: 'connection_string',
                read_only: false,
                name: snowflakeConnectionMock1.name,
                data_provider: snowflakeConnectionMock1.data_provider,
                visibility: snowflakeConnectionMock1.visibility,
                connection_string:
                  await snowflakeConnectionMock1.connection_string.decrypt(),
                warehouse: 'COMPUTE_WH'
              }
            })

            const connResponse = response.json()
            expect(connResponse).toEqual({
              type: 'create_connection',
              payload: {
                connection: {
                  ...removeConnectionString(snowflakeConnectionMock1),
                  created_at: expect.stringMatching(dateFormat),
                  id: expect.any(String)
                }
              }
            })
            expect(response.statusCode).toBe(201)

            await confirmSchemaImportJobExists(
              connResponse.payload.connection.id
            )
          })

          it('when connection_string is invalid should reply with ValidationError', async () => {
            const headers = await getAuthHeaders(name, user1.id)

            const response = await server.inject({
              headers,
              method: 'POST',
              url: `/v2/orgs/${organizationMock1.slug}/connections`,
              payload: {
                type: 'connection_string',
                read_only: false,
                name: postgresConnectionMock1.name,
                data_provider: postgresConnectionMock1.data_provider,
                visibility: postgresConnectionMock1.visibility,
                connection_string:
                  'postgres://invalid:invalid@invalid:5432/invalid'
              }
            })

            expect(response.statusCode).toBe(400)
            expect(response.json()).toEqual({
              type: 'validation_error',
              payload: {
                validation_error: {
                  message: `Connection "${postgresConnectionMock1.name}" failed to connect.`,
                  context: 'body',
                  errors: {
                    body: {
                      connection_string:
                        'must be a valid, working connection string'
                    }
                  }
                }
              }
            })
          })

          it('replies with validation error if snowflake is missing the warehouse value', async () => {
            const headers = await getAuthHeaders(name, user1.id)

            const response = await server.inject({
              headers,
              method: 'POST',
              url: `/v2/orgs/${organizationMock1.slug}/connections`,
              payload: {
                type: 'connection_string',
                name: 'snowing',
                connection_string: snowflakeConnStr,
                visibility: 'private',
                data_provider: snowflakeConnectionMockPartial.data_provider
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
                      warehouse: 'is required'
                    }
                  }
                }
              }
            })
            expect(response.statusCode).toBe(400)
          })

          describe('when visibility is null', () => {
            it('fails', async () => {
              const headers = await getAuthHeaders(name, user1.id)

              const response = await server.inject({
                headers,
                method: 'POST',
                url: `/v2/orgs/${organizationMock1.slug}/connections`,
                payload: {
                  type: 'connection_string',
                  read_only: false,
                  name: postgresConnectionMock1.name,
                  data_provider: postgresConnectionMock1.data_provider,
                  visibility: null,
                  connection_string:
                    'postgres://invalid:invalid@invalid:5432/invalid'
                }
              })

              expect(response.statusCode).toEqual(400)
              expect(response.json()).toEqual({
                type: 'validation_error',
                payload: {
                  validation_error: {
                    message:
                      'A validation error occurred when validating the body.',
                    context: 'body',
                    errors: {
                      body: {
                        visibility:
                          'must be one of the following values: "private" or "public"'
                      }
                    }
                  }
                }
              })
            })
          })

          it('should return an error if the connection is not created', async () => {
            const headers = await getAuthHeaders(name, user1.id)

            jest
              .spyOn(ConnectionsService, 'create')
              .mockRejectedValueOnce(new Error('some-error'))

            const response = await server.inject({
              headers,
              method: 'POST',
              url: `/v2/orgs/${organizationMock1.slug}/connections`,
              payload: {
                type: 'connection_string',
                read_only: false,
                name: postgresConnectionMock1.name,
                data_provider: postgresConnectionMock1.data_provider,
                visibility: postgresConnectionMock1.visibility,
                connection_string:
                  await postgresConnectionMock1.connection_string.decrypt()
              }
            })

            expect(response.statusCode).toBe(500)
            expect(response.json()).toEqual({
              type: 'error',
              payload: {
                error: {
                  message: expect.stringMatching(
                    /Internal server error\. If the problem persists, please contact support and include the following id: /g
                  )
                }
              }
            })
          })
        })
      })

      describe('when type is parameters', () => {
        describe('when the organization does not exist', () => {
          it('should respond with HTTP 404', async () => {
            const headers = await getAuthHeaders(name, user1.id)

            const response = await server.inject({
              headers,
              method: 'POST',
              url: '/v2/orgs/organization-3/connections',
              payload: {
                type: 'parameters',
                read_only: false,
                name: postgresConnectionMock1.name,
                data_provider: postgresConnectionMock1.data_provider,
                visibility: postgresConnectionMock1.visibility,
                parameters: {
                  host: postgresConnectionMock1ConnectionUrl.hostname,
                  port: postgresConnectionMock1ConnectionUrl.port,
                  user: postgresConnectionMock1ConnectionUrl.username,
                  password: postgresConnectionMock1ConnectionUrl.password,
                  database:
                    postgresConnectionMock1ConnectionUrl.pathname.substring(1)
                }
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

        describe('when the organization exists and the user exists but the user does not belong', () => {
          it('should respond with HTTP 404', async () => {
            const headers = await getAuthHeaders(name, user2.id)

            const response = await server.inject({
              headers,
              method: 'POST',
              url: `/v2/orgs/${organizationMock1.slug}/connections`,
              payload: {
                type: 'parameters',
                read_only: false,
                name: postgresConnectionMock1.name,
                data_provider: postgresConnectionMock1.data_provider,
                visibility: postgresConnectionMock1.visibility,
                parameters: {
                  host: postgresConnectionMock1ConnectionUrl.hostname,
                  port: postgresConnectionMock1ConnectionUrl.port,
                  user: postgresConnectionMock1ConnectionUrl.username,
                  password: postgresConnectionMock1ConnectionUrl.password,
                  database:
                    postgresConnectionMock1ConnectionUrl.pathname.substring(1)
                }
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

        describe('when the user is an owner of the organization', () => {
          it('should create and import the connection', async () => {
            const headers = await getAuthHeaders(name, user1.id)

            const response = await server.inject({
              headers,
              method: 'POST',
              url: `/v2/orgs/${organizationMock1.slug}/connections`,
              payload: {
                type: 'parameters',
                name: postgresConnectionMock1.name,
                read_only: false,
                data_provider: postgresConnectionMock1.data_provider,
                visibility: postgresConnectionMock1.visibility,
                parameters: {
                  host: postgresConnectionMock1ConnectionUrl.hostname,
                  port: postgresConnectionMock1ConnectionUrl.port,
                  user: postgresConnectionMock1ConnectionUrl.username,
                  password: postgresConnectionMock1ConnectionUrl.password,
                  database:
                    postgresConnectionMock1ConnectionUrl.pathname.substring(1)
                }
              }
            })

            expect(response.statusCode).toBe(201)
            const connResponse = response.json()
            expect(connResponse).toEqual({
              type: 'create_connection',
              payload: {
                connection: {
                  ...removeConnectionString(postgresConnectionMock1),
                  created_at: expect.stringMatching(dateFormat),
                  id: expect.any(String)
                }
              }
            })

            await confirmSchemaImportJobExists(
              connResponse.payload.connection.id
            )
          })

          it('should create and import the connection with a read-only connection', async () => {
            const headers = await getAuthHeaders(name, user1.id)

            // parent connection
            const response = await server.inject({
              headers,
              method: 'POST',
              url: `/v2/orgs/${organizationMock1.slug}/connections`,
              payload: {
                type: 'parameters',
                read_only: false,
                name: postgresConnectionMock1.name,
                data_provider: postgresConnectionMock1.data_provider,
                visibility: postgresConnectionMock1.visibility,
                parameters: {
                  host: postgresConnectionMock1ConnectionUrl.hostname,
                  port: postgresConnectionMock1ConnectionUrl.port,
                  user: postgresConnectionMock1ConnectionUrl.username,
                  password: postgresConnectionMock1ConnectionUrl.password,
                  database:
                    postgresConnectionMock1ConnectionUrl.pathname.substring(1)
                }
              }
            })

            const connResponse = response.json()
            expect(connResponse).toEqual({
              type: 'create_connection',
              payload: {
                connection: {
                  ...removeConnectionString(postgresConnectionMock1),
                  readonly_connection_id: null,
                  created_at: expect.stringMatching(dateFormat),
                  id: expect.any(String)
                }
              }
            })
            expect(response.statusCode).toBe(201)

            await confirmSchemaImportJobExists(
              connResponse.payload.connection.id
            )

            // read-only connection
            const readonlyResponse = await server.inject({
              headers,
              method: 'POST',
              url: `/v2/orgs/${organizationMock1.slug}/connections`,
              payload: {
                type: 'parameters',
                read_only: true,
                data_provider: postgresConnectionMock1.data_provider,
                parent_connection_id: connResponse.payload.connection.id,
                parameters: {
                  host: postgresConnectionMock1ConnectionUrl.hostname,
                  port: postgresConnectionMock1ConnectionUrl.port,
                  user: postgresConnectionMock1ConnectionUrl.username,
                  password: postgresConnectionMock1ConnectionUrl.password,
                  database:
                    postgresConnectionMock1ConnectionUrl.pathname.substring(1)
                }
              }
            })

            const readonlyConnResponse = readonlyResponse.json()
            expect(readonlyConnResponse).toEqual({
              type: 'create_connection',
              payload: {
                connection: {
                  ...removeConnectionString(postgresConnectionMock1),
                  readonly_connection_id: null,
                  name: expect.stringMatching(/.*-readonly$/),
                  created_at: expect.stringMatching(dateFormat),
                  id: expect.any(String)
                }
              }
            })
            expect(readonlyResponse.statusCode).toBe(201)

            await confirmSchemaImportJobExists(
              connResponse.payload.connection.id
            )

            const updatedParent = await ConnectionsService.getById(
              connResponse.payload.connection.id
            )
            expect(updatedParent).toEqual({
              ...removeConnectionString(postgresConnectionMock1),
              created_at: expect.any(Date),
              connection_string: expect.any(Object),
              name: postgresConnectionMock1.name,
              readonly_connection_id:
                readonlyConnResponse.payload.connection.id,
              id: expect.any(String)
            })
          })

          it('should return an error if the connection is not created', async () => {
            const headers = await getAuthHeaders(name, user1.id)

            jest
              .spyOn(ConnectionsService, 'create')
              .mockRejectedValueOnce(new Error('some-error'))

            const response = await server.inject({
              headers,
              method: 'POST',
              url: `/v2/orgs/${organizationMock1.slug}/connections`,
              payload: {
                type: 'parameters',
                read_only: false,
                name: postgresConnectionMock1.name,
                data_provider: postgresConnectionMock1.data_provider,
                visibility: 'private',
                parameters: {
                  host: postgresConnectionMock1ConnectionUrl.hostname,
                  port: postgresConnectionMock1ConnectionUrl.port,
                  user: postgresConnectionMock1ConnectionUrl.username,
                  password: postgresConnectionMock1ConnectionUrl.password,
                  database:
                    postgresConnectionMock1ConnectionUrl.pathname.substring(1)
                }
              }
            })

            expect(response.statusCode).toBe(500)
            expect(response.json()).toEqual({
              type: 'error',
              payload: {
                error: {
                  message: expect.stringMatching(
                    /Internal server error\. If the problem persists, please contact support and include the following id: /g
                  )
                }
              }
            })
          })

          it('replies with validation error if snowflake is missing the warehouse parameter', async () => {
            const headers = await getAuthHeaders(name, user1.id)

            const response = await server.inject({
              headers,
              method: 'POST',
              url: `/v2/orgs/${organizationMock1.slug}/connections`,
              payload: {
                type: 'parameters',
                name: 'snowing',
                read_only: false,
                visibility: 'private',
                data_provider: 'snowflake',
                parameters: {
                  host: 'sort.xyz',
                  port: '2145',
                  user: 'fake-user',
                  password: 'invalid-password',
                  database: 'nada'
                }
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
                      'parameters/warehouse': 'is required'
                    }
                  }
                }
              }
            })
            expect(response.statusCode).toBe(400)
          })
        })
      })
    })
  })

  describe('PATCH /v2/orgs/:slug/connections/:id', () => {
    describe.each(authTypes)('using $name auth', ({ name }) => {
      describe('when the organization does not exist', () => {
        it('should respond with HTTP 404', async () => {
          const headers = await getAuthHeaders(name, user1.id)

          const response = await server.inject({
            headers,
            method: 'PATCH',
            url: `/v2/orgs/invalid/connections/${postgresConnectionMock.id}`,
            payload: {
              type: 'connection_string',
              name: 'new name',
              data_provider: 'postgres',
              visibility: 'public',
              connection_string: 'new connection string'
            }
          })

          expect(response.statusCode).toEqual(404)
          expect(response.json()).toEqual({
            type: 'error',
            payload: { error: { message: 'Organization not found.' } }
          })
        })
      })

      describe('when the organization exists and the user exists but the user does not belong', () => {
        it('should respond with HTTP 404', async () => {
          const headers = await getAuthHeaders(name, user2.id)

          const response = await server.inject({
            headers,
            method: 'PATCH',
            url: `/v2/orgs/${organizationMock1.slug}/connections/${postgresConnectionMock.id}`,
            payload: {
              type: 'connection_string',
              name: 'new name',
              data_provider: 'postgres',
              visibility: 'public',
              connection_string: 'new connection string'
            }
          })

          expect(response.statusCode).toEqual(404)
          expect(response.json()).toEqual({
            type: 'error',
            payload: { error: { message: 'Organization not found.' } }
          })
        })
      })

      describe('when the user belongs to the organization', () => {
        describe('when the connection does not exist', () => {
          it('should respond with HTTP 404', async () => {
            const headers = await getAuthHeaders(name, user1.id)

            const slug = organizationMock1.slug
            const id = randomUUID()
            const url = `/v2/orgs/${slug}/connections/${id}`

            const response = await server.inject({
              headers,
              method: 'PATCH',
              url,
              payload: {
                type: 'connection_string',
                name: 'new name',
                data_provider: 'postgres',
                visibility: 'public',
                connection_string: 'new connection string'
              }
            })

            expect(response.statusCode).toEqual(404)
            expect(response.json()).toEqual({
              type: 'error',
              payload: { error: { message: 'Connection not found.' } }
            })
          })
        })

        describe('when the connection exists', () => {
          it('updates and creates a schema import job', async () => {
            const headers = await getAuthHeaders(name, user1.id)

            const newName = snowflakeConnectionMock1.name
            const newDataProvider = snowflakeConnectionMock1.data_provider
            const newVisibility: Visibility =
              postgresConnectionMock.visibility === 'private'
                ? 'public'
                : 'private'
            const newConnectionString =
              await snowflakeConnectionMock1.connection_string.decrypt()

            const response = await server.inject({
              headers,
              method: 'PATCH',
              url: `/v2/orgs/${organizationMock1.slug}/connections/${postgresConnectionMock.id}`,
              payload: {
                type: 'connection_string',
                name: newName,
                data_provider: newDataProvider,
                visibility: newVisibility,
                connection_string: newConnectionString,
                warehouse: snowflakeConnectionMock1.warehouse
              }
            })

            expect(response.json()).toEqual({
              type: 'update_connection',
              payload: {
                connection: {
                  ...removeConnectionString(postgresConnectionMock1),
                  name: newName,
                  data_provider: newDataProvider,
                  visibility: newVisibility,
                  created_at: expect.stringMatching(dateFormat),
                  warehouse: snowflakeConnectionMock1.warehouse
                }
              }
            })
            expect(response.statusCode).toEqual(200)

            await confirmSchemaImportJobExists(postgresConnectionMock.id)
          })

          describe('when name is null', () => {
            it('fails', async () => {
              const headers = await getAuthHeaders(name, user1.id)

              const response = await server.inject({
                headers,
                method: 'PATCH',
                url: `/v2/orgs/${organizationMock1.slug}/connections/${postgresConnectionMock.id}`,
                payload: {
                  type: 'connection_string',
                  name: null
                }
              })

              expect(response.statusCode).toEqual(400)
              expect(response.json()).toEqual({
                type: 'validation_error',
                payload: {
                  validation_error: {
                    message:
                      'A validation error occurred when validating the body.',
                    context: 'body',
                    errors: {
                      body: {
                        name: 'must not have fewer than 2 characters'
                      }
                    }
                  }
                }
              })
            })
          })

          describe('when connection_string is null', () => {
            it('fails', async () => {
              const headers = await getAuthHeaders(name, user1.id)

              const response = await server.inject({
                headers,
                method: 'PATCH',
                url: `/v2/orgs/${organizationMock1.slug}/connections/${postgresConnectionMock.id}`,
                payload: {
                  type: 'connection_string',
                  connection_string: null
                }
              })

              expect(response.statusCode).toEqual(400)
              expect(response.json()).toEqual({
                type: 'validation_error',
                payload: {
                  validation_error: {
                    message:
                      'A validation error occurred when validating the body.',
                    context: 'body',
                    errors: {
                      body: {
                        connection_string:
                          'must not have fewer than 2 characters'
                      }
                    }
                  }
                }
              })
            })
          })

          describe('when data_provider is null', () => {
            it('fails', async () => {
              const headers = await getAuthHeaders(name, user1.id)

              const response = await server.inject({
                headers,
                method: 'PATCH',
                url: `/v2/orgs/${organizationMock1.slug}/connections/${postgresConnectionMock.id}`,
                payload: {
                  type: 'connection_string',
                  data_provider: null
                }
              })

              expect(response.statusCode).toEqual(400)
              expect(response.json()).toEqual({
                type: 'validation_error',
                payload: {
                  validation_error: {
                    message:
                      'A validation error occurred when validating the body.',
                    context: 'body',
                    errors: {
                      body: {
                        data_provider:
                          'must be one of the following values: "postgres" or "snowflake"'
                      }
                    }
                  }
                }
              })
            })
          })

          describe('when visibility is null', () => {
            it('fails', async () => {
              const headers = await getAuthHeaders(name, user1.id)

              const response = await server.inject({
                headers,
                method: 'PATCH',
                url: `/v2/orgs/${organizationMock1.slug}/connections/${postgresConnectionMock.id}`,
                payload: {
                  type: 'connection_string',
                  data_provider: postgresConnectionMock.data_provider,
                  connection_string: postgresConnectionMock.connection_string,
                  visibility: null
                }
              })

              expect(response.statusCode).toEqual(400)
              expect(response.json()).toEqual({
                type: 'validation_error',
                payload: {
                  validation_error: {
                    message:
                      'A validation error occurred when validating the body.',
                    context: 'body',
                    errors: {
                      body: {
                        visibility:
                          'must be one of the following values: "private" or "public"'
                      }
                    }
                  }
                }
              })
            })
          })

          describe('when data_provider is snowflake and warehouse is not set', () => {
            it('fails when passing parameters', async () => {
              const headers = await getAuthHeaders(name, user1.id)

              const response = await server.inject({
                headers,
                method: 'PATCH',
                url: `/v2/orgs/${organizationMock1.slug}/connections/${postgresConnectionMock.id}`,
                payload: {
                  type: 'parameters',
                  name: 'howdy-missing-warehouse',
                  data_provider: 'snowflake',
                  parameters: {
                    host: 'sort.xyz',
                    port: '1234',
                    user: 'fake-user',
                    password: 'fake-password',
                    database: 'fake-database'
                  }
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
                        'parameters/warehouse': 'is required'
                      }
                    }
                  }
                }
              })
              expect(response.statusCode).toEqual(400)
            })

            it('fails when passing connection_string', async () => {
              const headers = await getAuthHeaders(name, user1.id)

              const response = await server.inject({
                headers,
                method: 'PATCH',
                url: `/v2/orgs/${organizationMock1.slug}/connections/${postgresConnectionMock.id}`,
                payload: {
                  type: 'connection_string',
                  name: 'howdy-missing-warehouse',
                  data_provider: 'snowflake',
                  connection_string:
                    await snowflakeConnectionMock1.connection_string.decrypt()
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
                        warehouse: 'is required'
                      }
                    }
                  }
                }
              })
              expect(response.statusCode).toEqual(400)
            })
          })

          describe('when data_provider is snowflake payload type does not match payload connection', () => {
            it('fails', async () => {
              const headers = await getAuthHeaders(name, user1.id)

              const response = await server.inject({
                headers,
                method: 'PATCH',
                url: `/v2/orgs/${organizationMock1.slug}/connections/${postgresConnectionMock.id}`,
                payload: {
                  type: 'connection_string',
                  name: 'howdy-missing-warehouse',
                  data_provider: 'snowflake',
                  parameters: {
                    host: 'sort.xyz',
                    port: '1234',
                    user: 'fake-user',
                    password: 'fake-password',
                    database: 'fake-database'
                  }
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
                        parameters: 'is not a valid property'
                      }
                    }
                  }
                }
              })
              expect(response.statusCode).toEqual(400)
            })

            it('fails', async () => {
              const headers = await getAuthHeaders(name, user1.id)

              const response = await server.inject({
                headers,
                method: 'PATCH',
                url: `/v2/orgs/${organizationMock1.slug}/connections/${postgresConnectionMock.id}`,
                payload: {
                  type: 'parameters',
                  name: 'howdy-missing-warehouse',
                  data_provider: 'snowflake',
                  connection_string:
                    await snowflakeConnectionMock1.connection_string.decrypt()
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
                        connection_string: 'is not a valid property'
                      }
                    }
                  }
                }
              })
              expect(response.statusCode).toEqual(400)
            })
          })
        })
      })
    })
  })

  describe('delete_connection operation', () => {
    describe.each(authTypes)('using $name auth', ({ name }) => {
      describe('when the organization does not exist', () => {
        it('should respond with HTTP 404', async () => {
          const headers = await getAuthHeaders(name, user1.id)

          const response = await server.inject({
            headers,
            method: 'DELETE',
            url: `/v2/orgs/invalid/connections/${postgresConnectionMock.id}`
          })

          expect(response.statusCode).toEqual(404)
          expect(response.json()).toEqual({
            type: 'error',
            payload: { error: { message: 'Connection not found.' } }
          })
        })
      })

      describe('when the organization exists and the user exists but the user does not belong', () => {
        it('should respond with HTTP 404', async () => {
          const headers = await getAuthHeaders(name, user2.id)

          const response = await server.inject({
            headers,
            method: 'DELETE',
            url: `/v2/orgs/${organizationMock1.slug}/connections/${postgresConnectionMock.id}`
          })

          expect(response.statusCode).toEqual(404)
          expect(response.json()).toEqual({
            type: 'error',
            payload: { error: { message: 'Connection not found.' } }
          })
        })
      })

      describe('when the user belongs to the organization', () => {
        describe('when the connection does not exist', () => {
          it('responds with HTTP 404', async () => {
            const headers = await getAuthHeaders(name, user1.id)

            const slug = organizationMock1.slug
            const id = randomUUID()
            const url = `/v2/orgs/${slug}/connections/${id}`

            const response = await server.inject({
              headers,
              method: 'DELETE',
              url
            })

            expect(response.statusCode).toEqual(404)
            expect(response.json()).toEqual({
              type: 'error',
              payload: { error: { message: 'Connection not found.' } }
            })
          })
        })

        describe('when the connection exists', () => {
          describe('when the user is not an owner of the organization', () => {
            it('responds with HTTP 404', async () => {
              const headers = await getAuthHeaders(name, user3.id)

              const slug = organizationMock1.slug
              const id = randomUUID()
              const url = `/v2/orgs/${slug}/connections/${id}`

              const response = await server.inject({
                headers,
                method: 'DELETE',
                url
              })

              expect(response.statusCode).toEqual(404)
              expect(response.json()).toEqual({
                type: 'error',
                payload: { error: { message: 'Connection not found.' } }
              })
            })
          })

          describe('when the user is an owner of the organization', () => {
            describe('when no child read-only connection exists', () => {
              it('deletes the connection', async () => {
                const headers = await getAuthHeaders(name, user1.id)

                const response = await server.inject({
                  headers,
                  method: 'DELETE',
                  url: `/v2/orgs/${organizationMock1.slug}/connections/${postgresConnectionMock.id}`
                })

                expect(response.statusCode).toEqual(200)

                expect(response.json()).toEqual({
                  type: 'success',
                  payload: {
                    success: {
                      message: `Connection ${postgresConnectionMock.id} deleted successfully.`
                    }
                  }
                })
              })
            })

            describe('parent + readonly child connections', () => {
              const createParentAndChildConnections = async (
                headers: Record<string, string>
              ) => {
                const parentResponse = await server.inject({
                  headers,
                  method: 'POST',
                  url: `/v2/orgs/${organizationMock1.slug}/connections`,
                  payload: {
                    type: 'connection_string',
                    read_only: false,
                    name: postgresConnectionMock1.name,
                    data_provider: postgresConnectionMock1.data_provider,
                    visibility: postgresConnectionMock1.visibility,
                    connection_string:
                      await postgresConnectionMock1.connection_string.decrypt()
                  }
                })
                expect(parentResponse.statusCode).toBe(201)

                const parentId = parentResponse.json().payload.connection.id
                const readonlyResponse = await server.inject({
                  headers,
                  method: 'POST',
                  url: `/v2/orgs/${organizationMock1.slug}/connections`,
                  payload: {
                    type: 'connection_string',
                    read_only: true,
                    parent_connection_id: parentId,
                    data_provider: postgresConnectionMock1.data_provider,
                    connection_string:
                      await postgresConnectionMock2.connection_string.decrypt()
                  }
                })
                expect(readonlyResponse.statusCode).toBe(201)

                return {
                  parentId,
                  readonlyId: readonlyResponse.json().payload.connection.id
                }
              }

              describe('when a child read-only connection exists and the parent is deleted', () => {
                it('also deletes the child read-only connection', async () => {
                  const headers = await getAuthHeaders(name, user1.id)

                  const { parentId, readonlyId } =
                    await createParentAndChildConnections(headers)

                  const response = await server.inject({
                    headers,
                    method: 'DELETE',
                    url: `/v2/orgs/${organizationMock1.slug}/connections/${parentId}`
                  })

                  expect(response.json()).toEqual({
                    type: 'success',
                    payload: {
                      success: {
                        message: `Connection ${parentId} deleted successfully.`
                      }
                    }
                  })
                  expect(response.statusCode).toEqual(200)

                  const parentGETResponse = await server.inject({
                    headers,
                    method: 'GET',
                    url: `/v2/orgs/${organizationMock1.slug}/connections/${parentId}`
                  })
                  expect(parentGETResponse.statusCode).toEqual(404)

                  const readonlyGETResponse = await server.inject({
                    headers,
                    method: 'GET',
                    url: `/v2/orgs/${organizationMock1.slug}/connections/${readonlyId}`
                  })
                  expect(readonlyGETResponse.statusCode).toEqual(404)
                })
              })

              describe('when the connection is a read-only child connection', () => {
                it('deletes the readonly connection and updates the parent connection', async () => {
                  const headers = await getAuthHeaders(name, user1.id)

                  const { parentId, readonlyId } =
                    await createParentAndChildConnections(headers)

                  const response = await server.inject({
                    headers,
                    method: 'DELETE',
                    url: `/v2/orgs/${organizationMock1.slug}/connections/${readonlyId}`
                  })

                  expect(response.json()).toEqual({
                    type: 'success',
                    payload: {
                      success: {
                        message: `Connection ${readonlyId} deleted successfully.`
                      }
                    }
                  })
                  expect(response.statusCode).toEqual(200)

                  const parentGETResponse = await server.inject({
                    headers,
                    method: 'GET',
                    url: `/v2/orgs/${organizationMock1.slug}/connections/${parentId}`
                  })
                  expect(parentGETResponse.statusCode).toEqual(200)
                  expect(
                    parentGETResponse.json().payload.connection
                      .readonly_connection_id
                  ).toBeNull()

                  const readonlyGETResponse = await server.inject({
                    headers,
                    method: 'GET',
                    url: `/v2/orgs/${organizationMock1.slug}/connections/${readonlyId}`
                  })
                  expect(readonlyGETResponse.statusCode).toEqual(404)
                })
              })
            })
          })
        })
      })
    })
  })

  describe('POST /v2/orgs/:slug/connections/test', () => {
    describe.each(authTypes)('using $name auth', ({ name }) => {
      describe('when the organization does not exist', () => {
        it('should respond with HTTP 404', async () => {
          const headers = await getAuthHeaders(name, user1.id)

          const response = await server.inject({
            headers,
            method: 'POST',
            url: '/v2/orgs/invalid/connections/test',
            body: {
              type: 'persisted',
              id: postgresConnectionMock.id
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

      describe('when the organization exists and the user exists but the user does not belong', () => {
        it('should respond with HTTP 404', async () => {
          const headers = await getAuthHeaders(name, user2.id)

          const response = await server.inject({
            headers,
            method: 'POST',
            url: `/v2/orgs/${organizationMock1.slug}/connections/test`,
            body: {
              type: 'persisted',
              id: postgresConnectionMock.id
            }
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
        describe('when connection id is passed', () => {
          it('should test a postgres connection for the given slug and params', async () => {
            const headers = await getAuthHeaders(name, user1.id)

            const response = await server.inject({
              headers,
              method: 'POST',
              url: `/v2/orgs/${organizationMock1.slug}/connections/test`,
              body: {
                type: 'persisted',
                id: postgresConnectionMock.id
              }
            })

            expect(response.statusCode).toBe(200)
            expect(response.json()).toEqual({
              type: 'test_connection',
              payload: {
                connection_test: {
                  success: true,
                  message:
                    'Connection "FIFA World Cup Stats" connected successfully.'
                }
              }
            })
          })

          it('should return 404 not found if the connection does not exist', async () => {
            const headers = await getAuthHeaders(name, user1.id)

            const response = await server.inject({
              headers,
              method: 'POST',
              url: `/v2/orgs/${organizationMock1.slug}/connections/test`,
              body: {
                type: 'persisted',
                id: randomUUID()
              }
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

          it('should return 404 not found if the connection belongs to another organization', async () => {
            const headers = await getAuthHeaders(name, user1.id)

            const response = await server.inject({
              headers,
              method: 'POST',
              url: `/v2/orgs/${organizationMock1.slug}/connections/test`,
              body: {
                type: 'persisted',
                id: snowflakeConnectionMock2.id
              }
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

        describe('when connection string and provider are passed', () => {
          describe('valid postgres connection info', () => {
            it('replies with connection test information', async () => {
              const headers = await getAuthHeaders(name, user1.id)

              const response = await server.inject({
                headers,
                method: 'POST',
                url: `/v2/orgs/${organizationMock1.slug}/connections/test`,
                body: {
                  type: 'connection_string',
                  connection_string: postgresConnectionMock.connection_string,
                  data_provider: postgresConnectionMock.data_provider
                }
              })

              expect(response.statusCode).toBe(200)
              expect(response.json()).toEqual({
                type: 'test_connection',
                payload: {
                  connection_test: {
                    success: true,
                    message: expect.stringMatching(
                      /Connection "ephemeral" connected successfully./
                    )
                  }
                }
              })
            })
          })

          describe('invalid postgres connection info', () => {
            it('replies with connection test information', async () => {
              const headers = await getAuthHeaders(name, user1.id)

              const response = await server.inject({
                headers,
                method: 'POST',
                url: `/v2/orgs/${organizationMock1.slug}/connections/test`,
                body: {
                  type: 'connection_string',
                  connection_string: 'invalid-connection',
                  data_provider: postgresConnectionMock.data_provider
                }
              })

              expect(response.statusCode).toBe(200)
              expect(response.json()).toEqual({
                type: 'test_connection',
                payload: {
                  connection_test: {
                    success: false,
                    message: expect.stringMatching(
                      /Connection "ephemeral" failed to connect./
                    )
                  }
                }
              })
            })
          })

          describe('valid snowflake connection info', () => {
            it('replies with connection test information', async () => {
              const headers = await getAuthHeaders(name, user1.id)

              const response = await server.inject({
                headers,
                method: 'POST',
                url: `/v2/orgs/${organizationMock1.slug}/connections/test`,
                body: {
                  type: 'connection_string',
                  connection_string: snowflakeConnStr,
                  data_provider: snowflakeConnectionMockPartial.data_provider,
                  warehouse: 'COMPUTE_WH'
                }
              })

              expect(response.statusCode).toBe(200)
              expect(response.json()).toEqual({
                type: 'test_connection',
                payload: {
                  connection_test: {
                    success: true,
                    message: expect.stringMatching(
                      /Connection "ephemeral" connected successfully./
                    )
                  }
                }
              })
            })
          })

          describe('invalid snowflake connection info', () => {
            it('replies with connection test information', async () => {
              const headers = await getAuthHeaders(name, user1.id)

              const response = await server.inject({
                headers,
                method: 'POST',
                url: `/v2/orgs/${organizationMock1.slug}/connections/test`,
                body: {
                  type: 'connection_string',
                  connection_string: 'invalid-connection',
                  data_provider: snowflakeConnectionMockPartial.data_provider,
                  warehouse: 'COMPUTE_WH'
                }
              })

              expect(response.statusCode).toBe(200)
              expect(response.json()).toEqual({
                type: 'test_connection',
                payload: {
                  connection_test: {
                    success: false,
                    message: expect.stringMatching(
                      /Connection "ephemeral" failed to connect./
                    )
                  }
                }
              })
            })

            it('missing warehouse replies with validation error', async () => {
              const headers = await getAuthHeaders(name, user1.id)

              const response = await server.inject({
                headers,
                method: 'POST',
                url: `/v2/orgs/${organizationMock1.slug}/connections/test`,
                body: {
                  type: 'connection_string',
                  connection_string: snowflakeConnStr,
                  data_provider: snowflakeConnectionMockPartial.data_provider
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
                        warehouse: 'is required'
                      }
                    }
                  }
                }
              })
              expect(response.statusCode).toBe(400)
            })

            it('invalid warehouse replies with test information', async () => {
              const headers = await getAuthHeaders(name, user1.id)

              const response = await server.inject({
                headers,
                method: 'POST',
                url: `/v2/orgs/${organizationMock1.slug}/connections/test`,
                body: {
                  type: 'connection_string',
                  connection_string: snowflakeConnStr,
                  data_provider: snowflakeConnectionMockPartial.data_provider,
                  warehouse: 'COMPUTE_WHs'
                }
              })

              expect(response.statusCode).toBe(200)
              expect(response.json()).toEqual({
                type: 'test_connection',
                payload: {
                  connection_test: {
                    success: false,
                    message: expect.stringMatching(
                      /Warehouse "COMPUTE_WHs" does not exist or is not accessible to this user./
                    )
                  }
                }
              })
            })

            it('invalid database replies with test information', async () => {
              const headers = await getAuthHeaders(name, user1.id)

              const response = await server.inject({
                headers,
                method: 'POST',
                url: `/v2/orgs/${organizationMock1.slug}/connections/test`,
                body: {
                  type: 'connection_string',
                  connection_string: changeDatabaseOfConnectionString({
                    connectionString: snowflakeConnStr,
                    dbName: 'foobar',
                    dataProvider: 'snowflake'
                  }),
                  data_provider: snowflakeConnectionMockPartial.data_provider,
                  warehouse: 'COMPUTE_WH'
                }
              })

              expect(response.json()).toEqual({
                type: 'test_connection',
                payload: {
                  connection_test: {
                    success: false,
                    message: expect.stringMatching(
                      /Database "foobar" not found./
                    )
                  }
                }
              })
              expect(response.statusCode).toBe(200)
            })
          })

          describe('snowflake connection info that will timeout', () => {
            let originalTimeout: number

            beforeAll(() => {
              originalTimeout =
                config.USER_FACING_EXTERNAL_DB_CONNECTION_TIMEOUT_MS
              config.USER_FACING_EXTERNAL_DB_CONNECTION_TIMEOUT_MS = 10
            })

            afterAll(() => {
              config.USER_FACING_EXTERNAL_DB_CONNECTION_TIMEOUT_MS =
                originalTimeout
            })

            it('replies with connection test information', async () => {
              const headers = await getAuthHeaders(name, user1.id)

              const changedUserNameSnowflakeConnStr = snowflakeConnStr.replace(
                snowflakeUser,
                'sdjfakas'
              )

              const response = await server.inject({
                headers,
                method: 'POST',
                url: `/v2/orgs/${organizationMock1.slug}/connections/test`,
                body: {
                  type: 'connection_string',
                  connection_string: changedUserNameSnowflakeConnStr,
                  data_provider: snowflakeConnectionMockPartial.data_provider,
                  warehouse: 'COMPUTE_WH'
                }
              })

              expect(response.json()).toEqual({
                type: 'test_connection',
                payload: {
                  connection_test: {
                    success: false,
                    message: expect.stringMatching(
                      /Connection "ephemeral" timed out./
                    )
                  }
                }
              })
              expect(response.statusCode).toBe(200)
            })
          })
        })
      })
    })
  })
})
