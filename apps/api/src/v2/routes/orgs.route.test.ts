import { DEFAULT_ORG_DESCRIPTION } from '@sort/shared/constants/metadata.constant'
import { dateFormat } from '@sort/shared/constants/type-mask.constant'
import { ChangeRequestMock } from '@sort/shared/mocks/change-requests/change-request.mock'
import { ConnectionMock } from '@sort/shared/mocks/connection.mock'
import { IssueMock } from '@sort/shared/mocks/issue.mock'
import { LabelMock } from '@sort/shared/mocks/label.mock'
import { MetadataDatabaseMock } from '@sort/shared/mocks/metadata.mock'
import {
  ownerPermissionsMock,
  nonMemberPermissionsMock,
  OrganizationMock
} from '@sort/shared/mocks/org.mock'
import { UserMock } from '@sort/shared/mocks/user.mock'
import * as ChangeRequestService from '@sort/shared/services/change-requests/change-request.service'
import * as ConnectionService from '@sort/shared/services/connection.service'
import * as IssueService from '@sort/shared/services/issue.service'
import * as MetadataDatabaseService from '@sort/shared/services/kysely/metadata/database.service'
import * as LabelService from '@sort/shared/services/label.service'
import * as OrganizationService from '@sort/shared/services/org.service'
import * as UserService from '@sort/shared/services/user.service'

import * as KyselyService from '../../global/services/kysely.service'
import { getDb } from '../../global/services/kysely.service'
import { getTestServer } from '../../global/utils/test.util'
import { getAuthHeaders, testInvalidSortAuthHeaders } from '../utils/test.util'

import type { Organization } from '@sort/shared/schemas/org.schema'
import type { FastifyInstance } from 'fastify'

describe('/v2 organizations routes', () => {
  const userMock = new UserMock()
  const orgMock = new OrganizationMock()
  const connMock = new ConnectionMock()
  const dbMock = new MetadataDatabaseMock()
  const labelMock = new LabelMock()
  const issueMock = new IssueMock()
  const changeRequestMock = new ChangeRequestMock()

  let server: FastifyInstance

  const userMock1 = userMock.create()
  const organizationMock1 = orgMock.create({ created_by: userMock1.id })
  const prvConn = connMock.create({
    organization_id: organizationMock1.id,
    created_by: userMock1.id
  })
  const prvDbEntry = dbMock.create({
    organization_id: organizationMock1.id,
    connection_id: prvConn.id
  })
  const label1 = labelMock.create({
    connection_id: prvConn.id,
    database_name: prvDbEntry.raw_name
  })
  const label2 = labelMock.create({
    connection_id: prvConn.id,
    database_name: prvDbEntry.raw_name
  })
  const mockIssue = issueMock.create({
    created_by: userMock1.id,
    connection_id: prvConn.id,
    description: 'This is a test issue',
    database_name: prvDbEntry.raw_name
  })
  const mockChangeRequest = changeRequestMock.create({
    created_by: userMock1.id,
    connection_id: prvConn.id,
    database_name: prvDbEntry.raw_name,
    description: 'This is a test change request'
  })
  const mockChangeRequest2 = changeRequestMock.create({
    created_by: userMock1.id,
    connection_id: prvConn.id,
    database_name: prvDbEntry.raw_name,
    description: 'This is a test change request 2'
  })

  const userMock2 = userMock.create({ id: 'someone-else', username: 'zora' })
  const organizationMock2 = orgMock.create({
    slug: 'organization-2',
    name: 'Organization 2',
    created_by: userMock2.id
  })
  const userMock3 = userMock.create({
    id: 'user3',
    username: 'gerudo',
    name: 'ger udo'
  })

  const cleanUp = async () => {
    await issueMock.removeAll()
    await changeRequestMock.removeAll()
    await labelMock.removeAll()
    await connMock.removeAll()
    await dbMock.removeAll()
    await orgMock.removeAll(true)
    await userMock.removeAll()
  }

  beforeEach(async () => {
    await cleanUp()

    await UserService.createUser({ ...userMock1 })
    await OrganizationService.create({ ...organizationMock1 })
    await ConnectionService.create(prvConn)
    await MetadataDatabaseService.insertMetadataDb(getDb(), prvDbEntry)
    await LabelService.createDatabaseLabel(label1)
    await LabelService.createDatabaseLabel(label2)
    await IssueService.createIssue({ ...mockIssue, labels: [label1, label2] })
    await ChangeRequestService.createChangeRequest(mockChangeRequest)
    await ChangeRequestService.createChangeRequest(mockChangeRequest2)
    await ChangeRequestService.updateChangeRequestStatus(
      getDb(),
      mockChangeRequest2.id,
      'closed'
    )
    await UserService.createUser({ ...userMock2 })
    await OrganizationService.create({ ...organizationMock2 })

    await UserService.createUser({ ...userMock3 })
    await OrganizationService.addMember(
      organizationMock1.slug,
      userMock3.id,
      'member'
    )
  })

  beforeAll(async () => {
    server = await getTestServer()
    KyselyService.createKysely()
  })

  afterAll(async () => {
    await cleanUp()
    await KyselyService.disconnectKysely()
  })

  const authTypes = [{ name: 'authorization' }, { name: 'x-api-key' }]

  describe('GET /v2/my/orgs', () => {
    testInvalidSortAuthHeaders({
      method: 'GET',
      url: '/v2/my/orgs'
    })

    describe.each(authTypes)('using $name auth', ({ name }) => {
      it('should return the list of organizations to which the member belongs', async () => {
        const headers = await getAuthHeaders(name, userMock1.id)

        const response = await server.inject({
          headers,
          method: 'GET',
          url: '/v2/my/orgs'
        })

        expect(response.statusCode).toBe(200)
        expect(response.json()).toEqual({
          type: 'list_my_organizations',
          payload: {
            organizations: [
              {
                ...organizationMock1,
                created_at: expect.stringMatching(dateFormat),
                created_by: userMock1.id,
                permissions: ownerPermissionsMock
              }
            ]
          }
        })
      })

      describe('when a service error occurs', () => {
        it('should respond with http 500', async () => {
          jest
            .spyOn(OrganizationService, 'getMyOrganizations')
            .mockRejectedValueOnce(new Error('fake error'))

          const headers = await getAuthHeaders(name, userMock1.id)

          const response = await server.inject({
            headers,
            method: 'GET',
            url: '/v2/my/orgs'
          })

          expect(response.statusCode).toBe(500)
          expect(response.json()).toEqual({
            type: 'error',
            payload: {
              error: {
                message: expect.stringMatching(/If the problem persists/)
              }
            }
          })
        })
      })
    })
  })

  describe('GET /v2/orgs/:slug', () => {
    testInvalidSortAuthHeaders({
      method: 'GET',
      url: '/v2/orgs/hello'
    })

    describe.each(authTypes)('using $name auth', ({ name }) => {
      describe('when the organization does not exist', () => {
        it('should respond with HTTP 404', async () => {
          const headers = await getAuthHeaders(name, userMock1.id)

          const response = await server.inject({
            headers,
            method: 'GET',
            url: '/v2/orgs/invalid'
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

        describe('when the slug param is too long', () => {
          // fastify (and FindMyWay) have a default limit of 100 characters for params

          it('should respond with correctly formatted HTTP 404', async () => {
            const headers = await getAuthHeaders(name, userMock1.id)

            const url = `/v2/orgs/${'x'.repeat(101)}`
            const response = await server.inject({
              headers,
              method: 'GET',
              url
            })

            expect(response.statusCode).toBe(404)
            expect(response.json()).toEqual({
              type: 'error',
              payload: {
                error: {
                  message: `Route GET:${url} not found.`
                }
              }
            })
          })
        })
      })

      describe('when the organization exists and the user exists but the user does not belong', () => {
        it('should return the organization with the given slug', async () => {
          const headers = await getAuthHeaders(name, userMock2.id)

          const response = await server.inject({
            headers,
            method: 'GET',
            url: `/v2/orgs/${organizationMock1.slug}`
          })

          expect(response.statusCode).toBe(200)
          expect(response.json()).toEqual({
            type: 'get_organization',
            payload: {
              organization: {
                ...organizationMock1,
                created_at: organizationMock1.created_at.toISOString(),
                created_by: userMock1.id,
                permissions: nonMemberPermissionsMock
              }
            }
          })
        })
      })

      describe('when the user belongs to the organization', () => {
        it('should return the organization with the given slug', async () => {
          const headers = await getAuthHeaders(name, userMock1.id)

          const response = await server.inject({
            headers,
            method: 'GET',
            url: `/v2/orgs/${organizationMock1.slug}`
          })

          expect(response.statusCode).toBe(200)
          expect(response.json()).toEqual({
            type: 'get_organization',
            payload: {
              organization: {
                ...organizationMock1,
                created_at: organizationMock1.created_at.toISOString(),
                created_by: userMock1.id,
                permissions: ownerPermissionsMock
              }
            }
          })
        })
      })

      describe('when a service error occurs', () => {
        it('should respond with http 500', async () => {
          jest
            .spyOn(OrganizationService, 'getBySlug')
            .mockRejectedValueOnce(new Error('fake error'))

          const headers = await getAuthHeaders(name, userMock1.id)

          const response = await server.inject({
            headers,
            method: 'GET',
            url: '/v2/orgs/drip'
          })

          expect(response.statusCode).toBe(500)
          expect(response.json()).toEqual({
            type: 'error',
            payload: {
              error: {
                message: expect.stringMatching(/If the problem persists/)
              }
            }
          })
        })
      })
    })
  })

  describe('GET /v2/orgs/:slug/dashboard', () => {
    testInvalidSortAuthHeaders({
      method: 'GET',
      url: '/v2/orgs/hello/dashboard'
    })

    describe.each(authTypes)('using $name auth', ({ name }) => {
      describe('when the organization does not exist', () => {
        it('should respond with HTTP 404', async () => {
          const headers = await getAuthHeaders(name, userMock1.id)

          const response = await server.inject({
            headers,
            method: 'GET',
            url: '/v2/orgs/invalid/dashboard'
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

        describe('when the organization exists and the user exists but the user does not belong', () => {
          it('should return the organization with the given slug', async () => {
            const headers = await getAuthHeaders(name, userMock2.id)

            const response = await server.inject({
              headers,
              method: 'GET',
              url: `/v2/orgs/${organizationMock1.slug}`
            })

            expect(response.statusCode).toBe(200)
            expect(response.json()).toEqual({
              type: 'get_organization',
              payload: {
                organization: {
                  ...organizationMock1,
                  created_at: organizationMock1.created_at.toISOString(),
                  created_by: userMock1.id,
                  permissions: nonMemberPermissionsMock
                }
              }
            })
          })
        })

        describe('when the user belongs to the organization', () => {
          it("should return change requests and issues for organization's dashboard", async () => {
            const headers = await getAuthHeaders(name, userMock1.id)

            const response = await server.inject({
              headers,
              method: 'GET',
              url: `/v2/orgs/${organizationMock1.slug}/dashboard`
            })

            expect(response.statusCode).toBe(200)
            expect(response.json()).toEqual({
              type: 'get_organization_dashboard',
              payload: {
                dashboard: expect.arrayContaining([
                  {
                    id: mockIssue.id,
                    item_number: 1,
                    item_type: 'issue',
                    status: 'open',
                    title: mockIssue.title,
                    description: mockIssue.description,
                    updated_at: expect.any(String),
                    created_at: expect.any(String),
                    created_by: userMock1.id,
                    database_name: prvDbEntry.raw_name,
                    database_slug: prvDbEntry.slug,
                    assignees: [],
                    reviewers: [],
                    labels: expect.arrayContaining([
                      expect.objectContaining({
                        id: label1.id,
                        name: label1.name,
                        color: label1.color
                      }),
                      expect.objectContaining({
                        id: label2.id,
                        name: label2.name,
                        color: label2.color
                      })
                    ])
                  },
                  {
                    id: mockChangeRequest.id,
                    item_number: 2,
                    item_type: 'change_request',
                    status: 'open',
                    title: mockChangeRequest.title,
                    description: mockChangeRequest.description,
                    updated_at: expect.any(String),
                    created_at: expect.any(String),
                    created_by: userMock1.id,
                    database_name: prvDbEntry.raw_name,
                    database_slug: prvDbEntry.slug,
                    assignees: [],
                    reviewers: [],
                    labels: []
                  },
                  {
                    id: mockChangeRequest2.id,
                    item_number: 3,
                    item_type: 'change_request',
                    status: 'closed',
                    title: mockChangeRequest2.title,
                    description: mockChangeRequest2.description,
                    updated_at: expect.any(String),
                    created_at: expect.any(String),
                    created_by: userMock1.id,
                    database_name: prvDbEntry.raw_name,
                    database_slug: prvDbEntry.slug,
                    assignees: [],
                    reviewers: [],
                    labels: []
                  }
                ])
              }
            })
          })

          it("should return issues for organization's dashboard", async () => {
            const headers = await getAuthHeaders(name, userMock1.id)

            const response = await server.inject({
              headers,
              method: 'GET',
              url: `/v2/orgs/${organizationMock1.slug}/dashboard?item_type=issue`
            })

            expect(response.statusCode).toBe(200)
            expect(response.json()).toEqual({
              type: 'get_organization_dashboard',
              payload: {
                dashboard: expect.arrayContaining([
                  {
                    id: mockIssue.id,
                    item_number: 1,
                    item_type: 'issue',
                    status: 'open',
                    title: mockIssue.title,
                    description: mockIssue.description,
                    created_at: expect.any(String),
                    updated_at: expect.any(String),
                    created_by: userMock1.id,
                    database_name: prvDbEntry.raw_name,
                    database_slug: prvDbEntry.slug,
                    assignees: [],
                    reviewers: [],
                    labels: expect.arrayContaining([
                      expect.objectContaining({
                        id: label1.id,
                        name: label1.name,
                        color: label1.color
                      }),
                      expect.objectContaining({
                        id: label2.id,
                        name: label2.name,
                        color: label2.color
                      })
                    ])
                  }
                ])
              }
            })
          })

          it("should return closed status change requestsfor organization's dashboard", async () => {
            const headers = await getAuthHeaders(name, userMock1.id)

            const response = await server.inject({
              headers,
              method: 'GET',
              url: `/v2/orgs/${organizationMock1.slug}/dashboard?status=closed&item_type=change_request`
            })

            expect(response.statusCode).toBe(200)
            expect(response.json()).toEqual({
              type: 'get_organization_dashboard',
              payload: {
                dashboard: [
                  {
                    id: mockChangeRequest2.id,
                    item_number: 3,
                    item_type: 'change_request',
                    status: 'closed',
                    title: mockChangeRequest2.title,
                    description: mockChangeRequest2.description,
                    created_at: expect.any(String),
                    updated_at: expect.any(String),
                    created_by: userMock1.id,
                    database_name: prvDbEntry.raw_name,
                    database_slug: prvDbEntry.slug,
                    assignees: [],
                    reviewers: [],
                    labels: []
                  }
                ]
              }
            })
          })
        })

        describe('when a service error occurs', () => {
          it('should respond with http 500', async () => {
            jest
              .spyOn(OrganizationService, 'getBySlug')
              .mockRejectedValueOnce(new Error('fake error'))

            const headers = await getAuthHeaders(name, userMock1.id)

            const response = await server.inject({
              headers,
              method: 'GET',
              url: '/v2/orgs/drip/dashboard'
            })

            expect(response.statusCode).toBe(500)
            expect(response.json()).toEqual({
              type: 'error',
              payload: {
                error: {
                  message: expect.stringMatching(/If the problem persists/)
                }
              }
            })
          })
        })
      })
    })
  })

  describe('POST /v2/orgs', () => {
    testInvalidSortAuthHeaders({
      method: 'POST',
      url: '/v2/orgs'
    })

    describe.each(authTypes)('using $name auth', ({ name }) => {
      describe('when invalid data is provided', () => {
        it('should respond with HTTP 400', async () => {
          const headers = await getAuthHeaders(name, userMock1.id)

          const response = await server.inject({
            headers,
            method: 'POST',
            payload: {
              nope: 'invalid'
            },
            url: '/v2/orgs'
          })

          expect(response.statusCode).toBe(400)
          expect(response.json()).toEqual({
            type: 'validation_error',
            payload: {
              validation_error: {
                message:
                  'A validation error occurred when validating the body.',
                context: 'body',
                errors: {
                  body: {
                    name: 'is required'
                  }
                }
              }
            }
          })
        })
      })

      describe('when the sortui service account is used', () => {
        const slug = String(Math.random())
        const svcAccount = userMock.createSortWebServiceAccount()

        beforeEach(async () => {
          await UserService.createUser(svcAccount)
        })

        afterEach(async () => {
          await OrganizationService.removeBySlug(slug)
        })

        it('should respond with HTTP 401', async () => {
          const headers = await getAuthHeaders(name, svcAccount.id)

          const payload = {
            name: 'New Organization',
            slug,
            description: 'A new organization',
            link: 'https://sort.xyz'
          }

          const response = await server.inject({
            headers,
            method: 'POST',
            payload,
            url: '/v2/orgs'
          })

          expect(response.statusCode).toBe(401)
          expect(response.json()).toEqual({
            type: 'error',
            payload: {
              error: { message: 'Not Authorized.' }
            }
          })
        })
      })

      describe('when required data is provided', () => {
        describe('when the slug is not taken', () => {
          const slug = String(Math.random())

          it('should create a new organization', async () => {
            const headers = await getAuthHeaders(name, userMock1.id)

            const payload = {
              name: 'New Organization',
              slug,
              description: 'A new organization',
              link: 'https://example.com'
            }

            const response = await server.inject({
              headers,
              method: 'POST',
              payload,
              url: '/v2/orgs'
            })

            expect(response.statusCode).toBe(201)
            expect(response.json()).toEqual({
              type: 'create_organization',
              payload: {
                organization: {
                  id: expect.any(String),
                  name: payload.name,
                  slug: payload.slug,
                  slack_webhook_url: null,
                  discord_webhook_url: null,
                  banner: null,
                  description: payload.description,
                  link: payload.link,
                  created_at: expect.stringMatching(dateFormat),
                  created_by: userMock1.id
                }
              }
            })
          })

          afterAll(async () => {
            await OrganizationService.removeBySlug(slug)
          })
        })

        describe('when the slug is already taken', () => {
          const slug = 'new-organization'

          it('should respond with HTTP 409', async () => {
            const headers = await getAuthHeaders(name, userMock1.id)

            const payload = {
              name: 'New Organization',
              slug,
              description: 'A new organization',
              link: 'https://example.com'
            }

            const response = await server.inject({
              headers,
              method: 'POST',
              payload,
              url: '/v2/orgs'
            })

            expect(response.statusCode).toBe(201)

            const response2 = await server.inject({
              headers,
              method: 'POST',
              payload,
              url: '/v2/orgs'
            })

            expect(response2.statusCode).toBe(409)
            expect(response2.json()).toEqual({
              type: 'error',
              payload: {
                error: {
                  message: 'Organization slug already exists.'
                }
              }
            })
          })

          afterAll(async () => {
            await OrganizationService.removeBySlug(slug)
          })
        })

        describe('when the slug includes invalid characters', () => {
          it('should respond with HTTP 400', async () => {
            const headers = await getAuthHeaders(name, userMock1.id)

            const payload = {
              name: 'New Organization',
              slug: 'org@nization',
              description: 'A new organization',
              link: 'http://example.com'
            }

            const response = await server.inject({
              headers,
              method: 'POST',
              payload,
              url: '/v2/orgs'
            })

            expect(response.statusCode).toBe(400)
            expect(response.json()).toEqual({
              type: 'validation_error',
              payload: {
                validation_error: {
                  message:
                    'A validation error occurred when validating the body.',
                  context: 'body',
                  errors: {
                    body: {
                      slug: 'must match pattern "^[a-zA-Z0-9]+[\\-\\._a-zA-Z0-9]*$"'
                    }
                  }
                }
              }
            })
          })
        })

        describe('when the slug is too long', () => {
          it('should respond with HTTP 400', async () => {
            const headers = await getAuthHeaders(name, userMock1.id)

            const payload = {
              name: 'New Organization',
              slug: 'x'.repeat(100),
              description: 'A new organization',
              link: 'http://example.com'
            }

            const response = await server.inject({
              headers,
              method: 'POST',
              payload,
              url: '/v2/orgs'
            })

            expect(response.statusCode).toBe(400)
            expect(response.json()).toEqual({
              type: 'validation_error',
              payload: {
                validation_error: {
                  message:
                    'A validation error occurred when validating the body.',
                  context: 'body',
                  errors: {
                    body: {
                      slug: 'must not have more than 99 characters'
                    }
                  }
                }
              }
            })
          })
        })

        describe('when the link is too long', () => {
          it('should respond with HTTP 400', async () => {
            const headers = await getAuthHeaders(name, userMock1.id)

            const payload = {
              name: 'New Organization',
              slug: 'hello_world',
              description: 'A new organization',
              link: `http://example.com/${'x'.repeat(500)}`
            }

            const response = await server.inject({
              headers,
              method: 'POST',
              payload,
              url: '/v2/orgs'
            })

            expect(response.statusCode).toBe(400)
            expect(response.json()).toEqual({
              type: 'validation_error',
              payload: {
                validation_error: {
                  message:
                    'A validation error occurred when validating the body.',
                  context: 'body',
                  errors: {
                    body: {
                      link: 'must not have more than 512 characters'
                    }
                  }
                }
              }
            })
          })
        })

        describe('when the link is an invalid uri', () => {
          it('should respond with HTTP 400', async () => {
            const headers = await getAuthHeaders(name, userMock1.id)

            const payload = {
              name: 'New Organization',
              slug: 'new-organization',
              description: 'A new organization',
              link: 'http'
            }

            const response = await server.inject({
              headers,
              method: 'POST',
              payload,
              url: '/v2/orgs'
            })

            expect(response.statusCode).toBe(400)
            expect(response.json()).toEqual({
              type: 'validation_error',
              payload: {
                validation_error: {
                  message:
                    'A validation error occurred when validating the body.',
                  context: 'body',
                  errors: {
                    body: {
                      link: expect.stringMatching(/must be a valid URI/)
                    }
                  }
                }
              }
            })
          })
        })

        describe('when link or description is not provided', () => {
          const slug = String(Math.random())

          it('should create a new organization with null link and default description', async () => {
            const headers = await getAuthHeaders(name, userMock1.id)

            const payload = {
              name: 'missing link and description',
              slug
            }

            const response = await server.inject({
              headers,
              method: 'POST',
              payload,
              url: '/v2/orgs'
            })

            expect(response.statusCode).toBe(201)
            expect(response.json()).toEqual({
              type: 'create_organization',
              payload: {
                organization: {
                  id: expect.any(String),
                  name: payload.name,
                  slug: payload.slug,
                  slack_webhook_url: null,
                  discord_webhook_url: null,
                  banner: null,
                  description: DEFAULT_ORG_DESCRIPTION,
                  link: null,
                  created_at: expect.stringMatching(dateFormat),
                  created_by: userMock1.id
                }
              }
            })
          })

          afterAll(async () => {
            await OrganizationService.removeBySlug(slug)
          })
        })

        describe('when link or description are null', () => {
          const slug = String(Math.random())

          it('should create a new organization with null link and default description', async () => {
            const headers = await getAuthHeaders(name, userMock1.id)

            const payload = {
              name: 'Example',
              slug,
              description: null,
              link: null
            }

            const response = await server.inject({
              headers,
              method: 'POST',
              payload,
              url: '/v2/orgs'
            })

            expect(response.statusCode).toBe(201)
            expect(response.json()).toEqual({
              type: 'create_organization',
              payload: {
                organization: {
                  ...payload,
                  slack_webhook_url: null,
                  discord_webhook_url: null,
                  banner: null,
                  description: DEFAULT_ORG_DESCRIPTION,
                  id: expect.any(String),
                  created_at: expect.stringMatching(dateFormat),
                  created_by: userMock1.id
                }
              }
            })
          })

          afterAll(async () => {
            await OrganizationService.removeBySlug(slug)
          })
        })

        describe('when the name is too long', () => {
          it('should respond with HTTP 400', async () => {
            const headers = await getAuthHeaders(name, userMock1.id)

            const payload = {
              name: 'x'.repeat(129),
              slug: 'hello_world',
              description: 'A new organization',
              link: 'http://example.com/x'
            }

            const response = await server.inject({
              headers,
              method: 'POST',
              payload,
              url: '/v2/orgs'
            })

            expect(response.statusCode).toBe(400)
            expect(response.json()).toEqual({
              type: 'validation_error',
              payload: {
                validation_error: {
                  message:
                    'A validation error occurred when validating the body.',
                  context: 'body',
                  errors: {
                    body: {
                      name: 'must not have more than 128 characters'
                    }
                  }
                }
              }
            })
          })
        })

        describe('when the description is too long', () => {
          it('should respond with HTTP 400', async () => {
            const headers = await getAuthHeaders(name, userMock1.id)

            const payload = {
              name: 'sort',
              slug: 'hello_world',
              description: 'x'.repeat(150001),
              link: 'http://example.com/x'
            }

            const response = await server.inject({
              headers,
              method: 'POST',
              payload,
              url: '/v2/orgs'
            })

            expect(response.statusCode).toBe(400)
            expect(response.json()).toEqual({
              type: 'validation_error',
              payload: {
                validation_error: {
                  message:
                    'A validation error occurred when validating the body.',
                  context: 'body',
                  errors: {
                    body: {
                      description: 'must not have more than 150000 characters'
                    }
                  }
                }
              }
            })
          })
        })
      })

      describe('when a service error occurs', () => {
        it('should respond with http 500', async () => {
          jest
            .spyOn(OrganizationService, 'create')
            .mockRejectedValueOnce(new Error('fake error'))

          const headers = await getAuthHeaders(name, userMock1.id)

          const payload = {
            name: 'New Organization 2',
            slug: 'new-organization-2',
            description: 'A new organization 2',
            link: 'https://example.com/2'
          }

          const response = await server.inject({
            headers,
            method: 'POST',
            payload,
            url: '/v2/orgs'
          })

          expect(response.statusCode).toBe(500)
          expect(response.json()).toEqual({
            type: 'error',
            payload: {
              error: {
                message: expect.stringMatching(/If the problem persists/)
              }
            }
          })
        })
      })
    })
  })

  describe('DELETE /v2/orgs/:slug', () => {
    testInvalidSortAuthHeaders({
      method: 'DELETE',
      url: '/v2/orgs/ikuru'
    })

    describe.each(authTypes)('using $name auth', ({ name }) => {
      it('should delete the organization with the given slug', async () => {
        const headers = await getAuthHeaders(name, userMock1.id)

        const response0 = await server.inject({
          headers,
          method: 'GET',
          url: `/v2/orgs/${organizationMock1.slug}`
        })

        expect(response0.statusCode).toBe(200)

        const response1 = await server.inject({
          headers,
          method: 'DELETE',
          url: `/v2/orgs/${organizationMock1.slug}`
        })

        expect(response1.statusCode).toBe(200)
        expect(response1.json()).toEqual({
          type: 'success',
          payload: {
            success: {
              message: `Organization ${organizationMock1.slug} deleted successfully.`
            }
          }
        })

        const response2 = await server.inject({
          headers,
          method: 'GET',
          url: `/v2/orgs/${organizationMock1.slug}`
        })

        expect(response2.statusCode).toBe(404)
      })

      describe('when the org does not exist', () => {
        it('should respond with HTTP 404', async () => {
          const headers = await getAuthHeaders(name, userMock1.id)

          const response = await server.inject({
            headers,
            method: 'DELETE',
            url: `/v2/orgs/${Date.now()}`
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
        it('should respond with HTTP 404', async () => {
          const headers = await getAuthHeaders(name, userMock1.id)

          const response = await server.inject({
            headers,
            method: 'DELETE',
            url: `/v2/orgs/${organizationMock2.slug}`
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

      describe('when a service error occurs', () => {
        it('should respond with http 500', async () => {
          jest
            .spyOn(OrganizationService, 'removeBySlug')
            .mockRejectedValueOnce(new Error('fake error'))

          const headers = await getAuthHeaders(name, userMock1.id)

          const response = await server.inject({
            headers,
            method: 'DELETE',
            url: `/v2/orgs/${organizationMock1.slug}`
          })

          expect(response.statusCode).toBe(500)
          expect(response.json()).toEqual({
            type: 'error',
            payload: {
              error: {
                message: expect.stringMatching(/If the problem persists/)
              }
            }
          })
        })
      })
    })
  })

  describe('PATCH /v2/orgs/:slug', () => {
    testInvalidSortAuthHeaders({
      method: 'PATCH',
      url: '/v2/orgs/living'
    })

    describe.each(authTypes)('using $name auth', ({ name }) => {
      describe('when the payload is invalid', () => {
        it('should respond with HTTP 400', async () => {
          const headers = await getAuthHeaders(name, userMock1.id)

          const response = await server.inject({
            headers,
            payload: { nope: 'invalid' },
            method: 'PATCH',
            url: `/v2/orgs/${organizationMock1.slug}`
          })

          expect(response.statusCode).toBe(400)
          expect(response.json()).toEqual({
            type: 'validation_error',
            payload: {
              validation_error: {
                message:
                  'A validation error occurred when validating the body.',
                context: 'body',
                errors: {
                  body: {
                    nope: 'is not a valid property'
                  }
                }
              }
            }
          })
        })

        describe('when the link is an invalid uri', () => {
          it('should respond with HTTP 400', async () => {
            const headers = await getAuthHeaders(name, userMock1.id)

            const payload = {
              name: 'New Organization',
              slug: 'new-organization',
              description: 'A new organization',
              link: 'http'
            }

            const response = await server.inject({
              headers,
              method: 'PATCH',
              payload,
              url: `/v2/orgs/${organizationMock1.slug}`
            })

            expect(response.statusCode).toBe(400)
            expect(response.json()).toEqual({
              type: 'validation_error',
              payload: {
                validation_error: {
                  message:
                    'A validation error occurred when validating the body.',
                  context: 'body',
                  errors: {
                    body: {
                      link: expect.stringMatching(/must be a valid URI/)
                    }
                  }
                }
              }
            })
          })
        })

        describe('when the link is too long', () => {
          it('should respond with HTTP 400', async () => {
            const headers = await getAuthHeaders(name, userMock1.id)

            const payload = {
              name: 'New Organization',
              slug: 'hello_world',
              description: 'A new organization',
              link: `http://example.com/${'x'.repeat(500)}`
            }

            const response = await server.inject({
              headers,
              method: 'PATCH',
              payload,
              url: `/v2/orgs/${organizationMock1.slug}`
            })

            expect(response.statusCode).toBe(400)
            expect(response.json()).toEqual({
              type: 'validation_error',
              payload: {
                validation_error: {
                  message:
                    'A validation error occurred when validating the body.',
                  context: 'body',
                  errors: {
                    body: {
                      link: 'must not have more than 512 characters'
                    }
                  }
                }
              }
            })
          })
        })

        describe('when the slug includes invalid characters', () => {
          it('should respond with HTTP 400', async () => {
            const headers = await getAuthHeaders(name, userMock1.id)

            const payload = {
              name: 'New Organization',
              slug: 'new-or[ganization',
              description: 'A new organization',
              link: 'http://example.com'
            }

            const response = await server.inject({
              headers,
              method: 'PATCH',
              payload,
              url: `/v2/orgs/${organizationMock1.slug}`
            })

            expect(response.statusCode).toBe(400)
            expect(response.json()).toEqual({
              type: 'validation_error',
              payload: {
                validation_error: {
                  message:
                    'A validation error occurred when validating the body.',
                  context: 'body',
                  errors: {
                    body: {
                      slug: 'must match pattern "^[a-zA-Z0-9]+[\\-\\._a-zA-Z0-9]*$"'
                    }
                  }
                }
              }
            })
          })
        })

        describe('when the slug is too long', () => {
          it('should respond with HTTP 400', async () => {
            const headers = await getAuthHeaders(name, userMock1.id)

            const payload = {
              name: 'New Organization',
              slug: 'x'.repeat(100),
              description: 'A new organization',
              link: 'http://example.com'
            }

            const response = await server.inject({
              headers,
              method: 'PATCH',
              payload,
              url: `/v2/orgs/${organizationMock1.slug}`
            })

            expect(response.statusCode).toBe(400)
            expect(response.json()).toEqual({
              type: 'validation_error',
              payload: {
                validation_error: {
                  message:
                    'A validation error occurred when validating the body.',
                  context: 'body',
                  errors: {
                    body: {
                      slug: 'must not have more than 99 characters'
                    }
                  }
                }
              }
            })
          })
        })

        describe('when the name is too long', () => {
          it('should respond with HTTP 400', async () => {
            const headers = await getAuthHeaders(name, userMock1.id)

            const payload = {
              name: 'x'.repeat(129),
              slug: 'hello_world',
              description: 'A new organization',
              link: 'http://example.com/x'
            }

            const response = await server.inject({
              headers,
              method: 'PATCH',
              payload,
              url: `/v2/orgs/${organizationMock1.slug}`
            })

            expect(response.statusCode).toBe(400)
            expect(response.json()).toEqual({
              type: 'validation_error',
              payload: {
                validation_error: {
                  message:
                    'A validation error occurred when validating the body.',
                  context: 'body',
                  errors: {
                    body: {
                      name: 'must not have more than 128 characters'
                    }
                  }
                }
              }
            })
          })
        })

        describe('when the description is too long', () => {
          it('should respond with HTTP 400', async () => {
            const headers = await getAuthHeaders(name, userMock1.id)

            const payload = {
              name: 'sort',
              slug: 'hello_world',
              description: 'x'.repeat(150001),
              link: 'http://example.com/x'
            }

            const response = await server.inject({
              headers,
              method: 'PATCH',
              payload,
              url: `/v2/orgs/${organizationMock1.slug}`
            })

            expect(response.statusCode).toBe(400)
            expect(response.json()).toEqual({
              type: 'validation_error',
              payload: {
                validation_error: {
                  message:
                    'A validation error occurred when validating the body.',
                  context: 'body',
                  errors: {
                    body: {
                      description: 'must not have more than 150000 characters'
                    }
                  }
                }
              }
            })
          })
        })

        describe('when the slack webhook is invalid', () => {
          it('should respond with HTTP 400', async () => {
            const headers = await getAuthHeaders(name, userMock1.id)

            const payload = {
              name: 'sort',
              slug: 'hello_world',
              description: 'description here',
              link: 'http://example.com/x',
              slack_webhook_url: 'invalid'
            }

            const response = await server.inject({
              headers,
              method: 'PATCH',
              payload,
              url: `/v2/orgs/${organizationMock1.slug}`
            })

            expect(response.statusCode).toBe(400)
            expect(response.json()).toEqual({
              type: 'validation_error',
              payload: {
                validation_error: {
                  message:
                    'A validation error occurred when validating the body.',
                  context: 'body',
                  errors: {
                    body: {
                      slack_webhook_url:
                        'must match pattern "^https:\\/\\/hooks\\.slack\\.com\\/services\\/.*$"'
                    }
                  }
                }
              }
            })
          })
        })

        describe('when the discord webhook is invalid', () => {
          it('should respond with HTTP 400', async () => {
            const headers = await getAuthHeaders(name, userMock1.id)

            const payload = {
              name: 'sort',
              slug: 'hello_world',
              description: 'description here',
              link: 'http://example.com/x',
              discord_webhook_url: 'https://sort.xyz'
            }

            const response = await server.inject({
              headers,
              method: 'PATCH',
              payload,
              url: `/v2/orgs/${organizationMock1.slug}`
            })

            expect(response.statusCode).toBe(400)
            expect(response.json()).toEqual({
              type: 'validation_error',
              payload: {
                validation_error: {
                  message:
                    'A validation error occurred when validating the body.',
                  context: 'body',
                  errors: {
                    body: {
                      discord_webhook_url:
                        'must match pattern "^https:\\/\\/discord\\.com\\/api\\/webhooks\\/.*$"'
                    }
                  }
                }
              }
            })
          })
        })

        describe('when banner is too long', () => {
          it('should respond with HTTP 400', async () => {
            const headers = await getAuthHeaders(name, userMock1.id)

            const payload = {
              name: 'sort',
              slug: 'hello_world',
              description: 'description here',
              link: 'http://example.com/x',
              banner: 'x'.repeat(10001)
            }

            const response = await server.inject({
              headers,
              method: 'PATCH',
              payload,
              url: `/v2/orgs/${organizationMock1.slug}`
            })

            expect(response.statusCode).toBe(400)
            expect(response.json()).toEqual({
              type: 'validation_error',
              payload: {
                validation_error: {
                  message:
                    'A validation error occurred when validating the body.',
                  context: 'body',
                  errors: {
                    body: {
                      banner: 'must not have more than 10000 characters'
                    }
                  }
                }
              }
            })
          })
        })
      })

      describe('when the org does not exist', () => {
        it('should respond with HTTP 404', async () => {
          const headers = await getAuthHeaders(name, userMock1.id)

          const response = await server.inject({
            headers,
            payload: { description: 'new-description' },
            method: 'PATCH',
            url: `/v2/orgs/${Date.now()}`
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
        it('should respond with HTTP 404', async () => {
          const headers = await getAuthHeaders(name, userMock1.id)

          const response = await server.inject({
            headers,
            payload: { description: 'new-description' },
            method: 'PATCH',
            url: `/v2/orgs/${organizationMock2.slug}`
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

      describe('when the slug is already taken', () => {
        it('should respond with HTTP 409', async () => {
          const headers = await getAuthHeaders(name, userMock1.id)

          const response = await server.inject({
            headers,
            payload: { slug: organizationMock2.slug },
            method: 'PATCH',
            url: `/v2/orgs/${organizationMock1.slug}`
          })

          expect(response.statusCode).toBe(409)
          expect(response.json()).toEqual({
            type: 'error',
            payload: {
              error: {
                message: 'Organization slug already taken.'
              }
            }
          })
        })
      })

      describe('when valid data is provided', () => {
        describe('when all fields are present', () => {
          const slug = `new-slug-${Math.random()}`

          it('should update the organization', async () => {
            const headers = await getAuthHeaders(name, userMock1.id)
            const newMetadata = {
              slug,
              link: 'https://example.com/new-org-name',
              name: 'my-new-org-name',
              description: 'my-new-description is here',
              banner: '[nice banner](https//sort.xyz)',
              slack_webhook_url:
                'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX',
              discord_webhook_url:
                'https://discord.com/api/webhooks/XXXXXXXXXXXXXXXXXXXXXXXX'
            }

            const response = await server.inject({
              headers,
              payload: newMetadata,
              method: 'PATCH',
              url: `/v2/orgs/${organizationMock1.slug}`
            })

            expect(response.json()).toEqual({
              type: 'update_organization',
              payload: {
                organization: {
                  ...organizationMock1,
                  ...newMetadata,
                  created_at: organizationMock1.created_at.toISOString(),
                  created_by: userMock1.id
                }
              }
            })
            expect(response.statusCode).toBe(200)
          })

          afterAll(async () => {
            await OrganizationService.removeBySlug(slug)
          })
        })

        describe('when link or description is not provided', () => {
          const slug = String(Math.random())

          it('should update the name and slug fields', async () => {
            const headers = await getAuthHeaders(name, userMock1.id)

            const payload = {
              name: 'missing link and description',
              slug
            }

            const response = await server.inject({
              headers,
              method: 'PATCH',
              payload,
              url: `/v2/orgs/${organizationMock1.slug}`
            })

            expect(response.statusCode).toBe(200)
            expect(response.json()).toEqual({
              type: 'update_organization',
              payload: {
                organization: {
                  id: expect.any(String),
                  name: payload.name,
                  slug: payload.slug,
                  slack_webhook_url: null,
                  discord_webhook_url: null,
                  banner: null,
                  description: organizationMock1.description,
                  link: organizationMock1.link,
                  created_at: expect.stringMatching(dateFormat),
                  created_by: userMock1.id
                }
              }
            })
          })

          afterAll(async () => {
            await OrganizationService.removeBySlug(slug)
          })
        })

        describe('when link, description, banner, slack_webhook_url or discord_webhook_url are null', () => {
          const slug = String(Math.random())

          it('should update the organization with fields set to null', async () => {
            const headers = await getAuthHeaders(name, userMock1.id)
            const createPayload = {
              ...organizationMock1,
              slug,
              link: 'https://sort.xyz/newlink',
              description: 'new description'
            }

            const response1 = await server.inject({
              headers,
              method: 'POST',
              payload: createPayload,
              url: '/v2/orgs'
            })

            expect(response1.json()).toEqual({
              type: 'create_organization',
              payload: {
                organization: {
                  ...createPayload,
                  created_at: expect.stringMatching(dateFormat),
                  id: expect.any(String)
                }
              }
            })
            expect(response1.statusCode).toBe(201)

            const createdOrg = response1.json().payload
              .organization as unknown as Organization

            const settingsOnlyPayload = {
              banner: 'new banner',
              slack_webhook_url: 'https://hooks.slack.com/services/T/B/X',
              discord_webhook_url: 'https://discord.com/api/webhooks/X'
            }

            const response2 = await server.inject({
              headers,
              method: 'PATCH',
              payload: settingsOnlyPayload,
              url: `/v2/orgs/${slug}`
            })

            expect(response2.json()).toEqual({
              type: 'update_organization',
              payload: {
                organization: {
                  ...createdOrg,
                  ...settingsOnlyPayload
                }
              }
            })
            expect(response2.statusCode).toBe(200)

            const setNullPayload = {
              description: null,
              link: null,
              banner: null,
              slack_webhook_url: null,
              discord_webhook_url: null
            }

            const response3 = await server.inject({
              headers,
              method: 'PATCH',
              payload: setNullPayload,
              url: `/v2/orgs/${slug}`
            })

            expect(response3.json()).toEqual({
              type: 'update_organization',
              payload: {
                organization: {
                  ...createdOrg,
                  ...setNullPayload
                }
              }
            })
            expect(response3.statusCode).toBe(200)
          })

          afterAll(async () => {
            await OrganizationService.removeBySlug(slug)
          })
        })
      })

      describe('when a service error occurs', () => {
        it('should respond with HTTP 500 and a friendly message', async () => {
          const headers = await getAuthHeaders(name, userMock1.id)
          const newMetadata = {
            slug: `new-slug-${Math.random()}`,
            link: 'https://example.com/new-org-name',
            name: 'my-new-org-name',
            description: 'my-new-description is here'
          }

          jest
            .spyOn(OrganizationService, 'updateBySlug')
            .mockRejectedValueOnce(new Error('fake error'))

          const response = await server.inject({
            headers,
            payload: newMetadata,
            method: 'PATCH',
            url: `/v2/orgs/${organizationMock1.slug}`
          })

          expect(response.statusCode).toBe(500)
          expect(response.json()).toEqual({
            type: 'error',
            payload: {
              error: {
                message: expect.stringMatching(/If the problem persists/)
              }
            }
          })
        })
      })
    })
  })

  describe('GET /v2/orgs/:slug/members', () => {
    testInvalidSortAuthHeaders({
      method: 'GET',
      url: '/v2/orgs/living/members'
    })

    describe.each(authTypes)('using $name auth', ({ name }) => {
      describe('when the organization does not exist', () => {
        it('should respond with HTTP 404', async () => {
          const headers = await getAuthHeaders(name, userMock1.id)

          const response = await server.inject({
            headers,
            method: 'GET',
            url: '/v2/orgs/invalid/members'
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
        it('should return the organization members', async () => {
          const headers = await getAuthHeaders(name, userMock2.id)

          const response = await server.inject({
            headers,
            method: 'GET',
            url: `/v2/orgs/${organizationMock1.slug}/members`
          })

          expect(response.statusCode).toBe(200)
          const result = response.json()
          expect(result).toEqual({
            type: 'list_organization_members',
            payload: {
              members: expect.arrayContaining([
                {
                  user: {
                    id: userMock1.id,
                    username: userMock1.username,
                    picture: userMock1.picture,
                    name: userMock1.name
                  },
                  role: { id: 0, name: 'owner' }
                },
                {
                  user: {
                    id: userMock3.id,
                    username: userMock3.username,
                    picture: userMock3.picture,
                    name: userMock3.name
                  },
                  role: { id: 1, name: 'member' }
                }
              ])
            }
          })
          expect(result.payload.members.length).toBe(2)
        })
      })

      describe('when the user belongs to the organization', () => {
        it('should return the organization members', async () => {
          const headers = await getAuthHeaders(name, userMock1.id)

          const response = await server.inject({
            headers,
            method: 'GET',
            url: `/v2/orgs/${organizationMock1.slug}/members`
          })

          expect(response.statusCode).toBe(200)
          const result = response.json()
          expect(result).toEqual({
            type: 'list_organization_members',
            payload: {
              members: expect.arrayContaining([
                {
                  user: {
                    id: userMock1.id,
                    name: userMock1.name,
                    username: userMock1.username,
                    picture: userMock1.picture
                  },
                  role: { id: 0, name: 'owner' }
                },
                {
                  user: {
                    id: userMock3.id,
                    name: userMock3.name,
                    username: userMock3.username,
                    picture: userMock3.picture
                  },
                  role: { id: 1, name: 'member' }
                }
              ])
            }
          })
          expect(result.payload.members.length).toBe(2)
        })
      })

      describe('when a service error occurs', () => {
        it('should respond with http 500', async () => {
          jest
            .spyOn(OrganizationService, 'getBySlug')
            .mockRejectedValueOnce(new Error('fake error'))

          const headers = await getAuthHeaders(name, userMock1.id)

          const response = await server.inject({
            headers,
            method: 'GET',
            url: `/v2/orgs/${organizationMock1.slug}/members`
          })

          expect(response.statusCode).toBe(500)
          expect(response.json()).toEqual({
            type: 'error',
            payload: {
              error: {
                message: expect.stringMatching(/If the problem persists/)
              }
            }
          })
        })
      })
    })
  })

  describe('PATCH /v2/orgs/:slug/members/:username', () => {
    testInvalidSortAuthHeaders({
      method: 'PATCH',
      url: '/v2/orgs/living/members/pinocchio'
    })

    describe.each(authTypes)('using $name auth', ({ name }) => {
      describe('when the organization does not exist', () => {
        it('should respond with HTTP 404', async () => {
          const headers = await getAuthHeaders(name, userMock1.id)

          const response = await server.inject({
            headers,
            payload: { role_id: 1 },
            method: 'PATCH',
            url: `/v2/orgs/invalid/members/${userMock3.username}`
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
        it('should respond with HTTP 403', async () => {
          const headers = await getAuthHeaders(name, userMock2.id)

          const response = await server.inject({
            headers,
            method: 'PATCH',
            url: `/v2/orgs/${organizationMock1.slug}/members/${userMock3.username}`,
            payload: { role_id: 1 }
          })

          expect(response.statusCode).toBe(403)
          expect(response.json()).toEqual({
            type: 'error',
            payload: {
              error: {
                message:
                  'You must be an organization owner to perform this action.'
              }
            }
          })
        })
      })

      describe('when the user belongs to the organization', () => {
        describe('but is not an owner', () => {
          it('responds with HTTP 403', async () => {
            const headers = await getAuthHeaders(name, userMock3.id)

            const response = await server.inject({
              headers,
              method: 'PATCH',
              url: `/v2/orgs/${organizationMock1.slug}/members/${userMock1.username}`,
              payload: { role_id: 1 }
            })

            expect(response.statusCode).toBe(403)
            expect(response.json()).toEqual({
              type: 'error',
              payload: {
                error: {
                  message:
                    'You must be an organization owner to perform this action.'
                }
              }
            })
          })

          describe('and they are updating themselves', () => {
            it('responds with HTTP 403', async () => {
              const headers = await getAuthHeaders(name, userMock3.id)

              const response = await server.inject({
                headers,
                method: 'PATCH',
                url: `/v2/orgs/${organizationMock1.slug}/members/${userMock3.username}`,
                payload: { role_id: 1 }
              })

              expect(response.statusCode).toBe(403)
              expect(response.json()).toEqual({
                type: 'error',
                payload: {
                  error: {
                    message:
                      'You must be an organization owner to perform this action.'
                  }
                }
              })
            })
          })
        })

        describe('and the user is an owner', () => {
          it('updates the member', async () => {
            const headers = await getAuthHeaders(name, userMock1.id)

            const response = await server.inject({
              headers,
              method: 'PATCH',
              url: `/v2/orgs/${organizationMock1.slug}/members/${userMock3.username}`,
              payload: { role_id: 1 }
            })

            expect(response.statusCode).toBe(200)
            expect(response.json()).toEqual({
              type: 'update_organization_member',
              payload: {
                member: {
                  user: {
                    id: userMock3.id,
                    name: userMock3.name,
                    username: userMock3.username,
                    picture: userMock3.picture
                  },
                  role: { id: 1, name: 'member' }
                }
              }
            })
          })

          describe('and they are the only owner', () => {
            it('should respond with HTTP 409', async () => {
              const headers = await getAuthHeaders(name, userMock2.id)

              const response = await server.inject({
                headers,
                method: 'PATCH',
                url: `/v2/orgs/${organizationMock2.slug}/members/${userMock2.username}`,
                payload: { role_id: 1 }
              })

              expect(response.statusCode).toBe(409)
              expect(response.json()).toEqual({
                type: 'error',
                payload: {
                  error: {
                    message: 'Cannot remove the last owner of an organization.'
                  }
                }
              })
            })
          })
        })
      })

      describe('when a service error occurs', () => {
        it('should respond with http 500', async () => {
          jest
            .spyOn(OrganizationService, 'updateMemberRole')
            .mockRejectedValueOnce(new Error('fake error'))

          const headers = await getAuthHeaders(name, userMock1.id)

          const response = await server.inject({
            headers,
            method: 'PATCH',
            url: `/v2/orgs/${organizationMock1.slug}/members/${userMock3.username}`,
            payload: { role_id: 1 }
          })

          expect(response.statusCode).toBe(500)
          expect(response.json()).toEqual({
            type: 'error',
            payload: {
              error: {
                message: expect.stringMatching(/If the problem persists/)
              }
            }
          })
        })
      })
    })
  })

  describe('DELETE /v2/orgs/:slug/members/:username', () => {
    testInvalidSortAuthHeaders({
      method: 'DELETE',
      url: '/v2/orgs/living/members/pinocchio'
    })

    describe.each(authTypes)('using $name auth', ({ name }) => {
      describe('when the organization does not exist', () => {
        it('should respond with HTTP 404', async () => {
          const headers = await getAuthHeaders(name, userMock1.id)

          const response = await server.inject({
            headers,
            method: 'DELETE',
            url: `/v2/orgs/invalid/members/${userMock3.username}`
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
        it('should respond with HTTP 403', async () => {
          const headers = await getAuthHeaders(name, userMock2.id)

          const response = await server.inject({
            headers,
            method: 'DELETE',
            url: `/v2/orgs/${organizationMock1.slug}/members/${userMock3.username}`
          })

          expect(response.statusCode).toBe(403)
          expect(response.json()).toEqual({
            type: 'error',
            payload: {
              error: {
                message:
                  'You must be an organization owner to perform this action.'
              }
            }
          })
        })
      })

      describe('when the user belongs to the organization', () => {
        describe('but is not an owner', () => {
          describe('and they are not removing themselves', () => {
            it('responds with HTTP 403', async () => {
              const headers = await getAuthHeaders(name, userMock3.id)

              const response = await server.inject({
                headers,
                method: 'DELETE',
                url: `/v2/orgs/${organizationMock1.slug}/members/${userMock1.username}`
              })

              expect(response.statusCode).toBe(403)
              expect(response.json()).toEqual({
                type: 'error',
                payload: {
                  error: {
                    message:
                      'You must be an organization owner to perform this action.'
                  }
                }
              })
            })

            describe('and they are removing themselves', () => {
              it('removes them', async () => {
                const headers = await getAuthHeaders(name, userMock3.id)

                const response = await server.inject({
                  headers,
                  method: 'DELETE',
                  url: `/v2/orgs/${organizationMock1.slug}/members/${userMock3.username}`
                })

                expect(response.statusCode).toBe(200)
                expect(response.json()).toEqual({
                  type: 'success',
                  payload: {
                    success: {
                      message: `Member ${userMock3.username} removed from organization ${organizationMock1.slug} successfully.`
                    }
                  }
                })
              })
            })
          })
        })

        describe('and the user is an owner', () => {
          describe('and they are the only owner', () => {
            it('should respond with HTTP 409', async () => {
              const headers = await getAuthHeaders(name, userMock2.id)

              const response = await server.inject({
                headers,
                method: 'DELETE',
                url: `/v2/orgs/${organizationMock2.slug}/members/${userMock2.username}`
              })

              expect(response.statusCode).toBe(409)
              expect(response.json()).toEqual({
                type: 'error',
                payload: {
                  error: {
                    message: 'Cannot remove the last owner of an organization.'
                  }
                }
              })
            })
          })

          describe('and there is another owner', () => {
            it('removes the member', async () => {
              const headers = await getAuthHeaders(name, userMock1.id)

              const response = await server.inject({
                headers,
                method: 'DELETE',
                url: `/v2/orgs/${organizationMock1.slug}/members/${userMock3.username}`
              })

              expect(response.statusCode).toBe(200)
              expect(response.json()).toEqual({
                type: 'success',
                payload: {
                  success: {
                    message: `Member ${userMock3.username} removed from organization ${organizationMock1.slug} successfully.`
                  }
                }
              })
            })
          })
        })
      })

      describe('when a service error occurs', () => {
        it('should respond with http 500', async () => {
          jest
            .spyOn(OrganizationService, 'removeMember')
            .mockRejectedValueOnce(new Error('fake error'))

          const headers = await getAuthHeaders(name, userMock1.id)

          const response = await server.inject({
            headers,
            method: 'DELETE',
            url: `/v2/orgs/${organizationMock1.slug}/members/${userMock3.username}`
          })

          expect(response.statusCode).toBe(500)
          expect(response.json()).toEqual({
            type: 'error',
            payload: {
              error: {
                message: expect.stringMatching(/If the problem persists/)
              }
            }
          })
        })
      })
    })
  })
})
