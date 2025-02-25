import { randomUUID } from 'node:crypto'

import { organizationMock } from '@sort/shared/mocks/org.mock'
import { UserMock } from '@sort/shared/mocks/user.mock'
import * as APIKeyService from '@sort/shared/services/apikey.service'
import * as NotificationService from '@sort/shared/services/notification.service'
import * as OrganizationInviteService from '@sort/shared/services/org-invite.service'
import * as OrganizationService from '@sort/shared/services/org.service'
import * as UserService from '@sort/shared/services/user.service'

import * as KyselyService from '../../../global/services/kysely.service'
import { getTestServer } from '../../../global/utils/test.util'
import { createSortJwt } from '../../utils/jwt.util'

describe('/v2/orgs/:slug/invites', () => {
  const userMock = new UserMock()

  let server: Awaited<ReturnType<typeof getTestServer>>
  let owner: Exclude<Awaited<ReturnType<typeof UserService.createUser>>, null>
  let ownersOrganization: Awaited<ReturnType<typeof OrganizationService.create>>
  let ownersOrganizationInvite: Awaited<
    ReturnType<typeof OrganizationInviteService.create>
  >

  let ownersAuthHeaders: Record<'authorization' | 'x-api-key', string>

  let user: Exclude<Awaited<ReturnType<typeof UserService.createUser>>, null>

  let usersAuthHeaders: Record<'authorization' | 'x-api-key', string>

  let anotherOwner: Exclude<
    Awaited<ReturnType<typeof UserService.createUser>>,
    null
  >
  let anotherOwnersOrganization: Awaited<
    ReturnType<typeof OrganizationService.create>
  >
  let anotherOwnersOrganizationInvite: Awaited<
    ReturnType<typeof OrganizationInviteService.create>
  >
  let anotherOwnersAuthHeaders: Record<'authorization' | 'x-api-key', string>

  beforeAll(async () => {
    server = await getTestServer()
    KyselyService.createKysely()
  })

  async function cleanup() {
    const orgs = [ownersOrganization, anotherOwnersOrganization].filter(Boolean)
    for (const org of orgs) {
      await OrganizationService.removeBySlug(org.slug)
    }

    await userMock.removeAll()
  }

  beforeEach(async () => {
    await cleanup()

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    owner = (await UserService.createUser(
      userMock.create({
        id: 'owner',
        username: 'owner'
      })
    ))!
    if (!owner) throw new Error('Failed to insert user')
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    user = (await UserService.createUser(
      userMock.create({
        id: 'user',
        username: 'user'
      })
    ))!
    if (!user) throw new Error('Failed to insert user')

    const ownersApiKey = await APIKeyService.createAPIKey({ userId: owner.id })
    if (!ownersApiKey) throw new Error('Failed to insert api key')
    const usersApiKey = await APIKeyService.createAPIKey({ userId: user.id })
    if (!usersApiKey) throw new Error('Failed to insert api key')
    ownersOrganization = await OrganizationService.create({
      ...organizationMock,
      id: randomUUID(),
      slug: 'owners-org',
      created_by: owner.id
    })

    ownersAuthHeaders = {
      authorization: `Bearer ${createSortJwt(owner.id)}`,
      'x-api-key': ownersApiKey.api_key
    }

    usersAuthHeaders = {
      authorization: `Bearer ${createSortJwt(user.id)}`,
      'x-api-key': usersApiKey.api_key
    }

    anotherOwner = (await UserService.createUser(
      userMock.create({
        id: 'other',
        username: 'other'
      })
    ))!
    if (!anotherOwner) throw new Error('Failed to insert user')

    const anotherOwnersApiKey = await APIKeyService.createAPIKey({
      userId: anotherOwner.id
    })
    if (!anotherOwnersApiKey) throw new Error('Failed to insert api key')

    anotherOwnersOrganization = await OrganizationService.create({
      ...organizationMock,
      id: randomUUID(),
      slug: 'another-users-org',
      created_by: anotherOwner.id
    })

    anotherOwnersAuthHeaders = {
      authorization: `Bearer ${createSortJwt(anotherOwner.id)}`,
      'x-api-key': anotherOwnersApiKey.api_key
    }

    ownersOrganizationInvite = await OrganizationInviteService.create({
      created_at: new Date(),
      created_by: owner.id,
      email: 'user@sort.xyz',
      id: randomUUID(),
      name: 'User',
      organization_id: ownersOrganization.id,
      role_id: 0,
      status: 'pending'
    })

    anotherOwnersOrganizationInvite = await OrganizationInviteService.create({
      created_at: new Date(),
      created_by: anotherOwner.id,
      email: 'another-user@sort.xyz',
      id: randomUUID(),
      name: 'Another User',
      organization_id: anotherOwnersOrganization.id,
      role_id: 0,
      status: 'pending'
    })
  })

  afterEach(async () => {
    await cleanup()
  })

  afterAll(async () => {
    await KyselyService.disconnectKysely()
  })

  describe('GET', () => {
    describe('when no authorization headers are passed', () => {
      it('returns status 401 with error', async () => {
        const response = await server.inject({
          method: 'GET',
          url: `/v2/orgs/${ownersOrganization.slug}/invites`
        })

        expect(response.statusCode).toBe(401)
        expect(response.json()).toEqual({
          type: 'error',
          payload: {
            error: {
              message: 'Not Authorized.'
            }
          }
        })
      })
    })

    describe.each([
      { authType: 'authorization' },
      { authType: 'x-api-key' }
    ] satisfies Record<'authType', keyof typeof anotherOwnersAuthHeaders>[])(
      'when authenticated as another owner with $authType',
      ({ authType }) => {
        it('returns status 403', async () => {
          const response = await server.inject({
            method: 'GET',
            url: `/v2/orgs/${ownersOrganization.slug}/invites`,
            headers: { [authType]: anotherOwnersAuthHeaders[authType] }
          })

          expect(response.statusCode).toBe(403)
          expect(response.json()).toEqual({
            type: 'error',
            payload: {
              error: {
                message: 'Only organization owners can view invites.'
              }
            }
          })
        })
      }
    )

    describe.each([
      { authType: 'authorization' },
      { authType: 'x-api-key' }
    ] satisfies Record<'authType', keyof typeof ownersAuthHeaders>[])(
      'when authenticated as owner with $authType',
      ({ authType }) => {
        it('returns status 200 with invites specific to an org', async () => {
          const response = await server.inject({
            method: 'GET',
            url: `/v2/orgs/${ownersOrganization.slug}/invites`,
            headers: { [authType]: ownersAuthHeaders[authType] }
          })

          expect(response.statusCode).toBe(200)
          expect(response.json()).toEqual({
            type: 'list_organization_invites',
            payload: {
              organization_invites: [
                {
                  ...ownersOrganizationInvite,
                  created_at: ownersOrganizationInvite.created_at.toJSON()
                }
              ]
            }
          })
        })
      }
    )
  })

  describe('POST', () => {
    describe('when no authorization headers are passed', () => {
      it('returns status 401 with error', async () => {
        const response = await server.inject({
          method: 'POST',
          url: `/v2/orgs/${ownersOrganization.slug}/invites`
        })

        expect(response.statusCode).toBe(401)
        expect(response.json()).toEqual({
          type: 'error',
          payload: {
            error: {
              message: 'Not Authorized.'
            }
          }
        })
      })
    })

    describe.each([
      { authType: 'authorization' },
      { authType: 'x-api-key' }
    ] satisfies Record<'authType', keyof typeof anotherOwnersAuthHeaders>[])(
      'when authenticated as another owner with $authType',
      ({ authType }) => {
        it('returns status 400 with ValidationError', async () => {
          const response = await server.inject({
            method: 'POST',
            url: `/v2/orgs/${ownersOrganization.slug}/invites`,
            headers: { [authType]: anotherOwnersAuthHeaders[authType] }
          })

          expect(response.statusCode).toBe(400)
          expect(response.json()).toEqual({
            type: 'validation_error',
            payload: {
              validation_error: {
                context: 'body',
                message:
                  'A validation error occurred when validating the body.',
                errors: {
                  body: {
                    $root: 'must be an object'
                  }
                }
              }
            }
          })
        })

        describe('when payload is valid', () => {
          it('returns status 403 with error', async () => {
            const payload = {
              name: 'Test User',
              email: 'test-user@sort.xyz',
              role_id: 0
            }

            const response = await server.inject({
              method: 'POST',
              url: `/v2/orgs/${ownersOrganization.slug}/invites`,
              headers: { [authType]: anotherOwnersAuthHeaders[authType] },
              payload
            })

            expect(response.statusCode).toBe(403)
            expect(response.json()).toEqual({
              type: 'error',
              payload: {
                error: {
                  message: 'Only organization owners can invite new members.'
                }
              }
            })
          })

          it('returns status 400 with validation_error for self-invite', async () => {
            const payload = {
              name: owner.name,
              email: owner.email,
              role_id: 0
            }

            const response = await server.inject({
              method: 'POST',
              url: `/v2/orgs/${ownersOrganization.slug}/invites`,
              headers: { [authType]: ownersAuthHeaders[authType] },
              payload
            })

            expect(response.statusCode).toBe(400)
            expect(response.json()).toEqual({
              type: 'validation_error',
              payload: {
                validation_error: {
                  message: 'Cannot invite yourself.',
                  context: 'body',
                  errors: {
                    body: { email: 'Cannot invite yourself.' }
                  }
                }
              }
            })
          })
        })
      }
    )

    describe.each([
      { authType: 'authorization' },
      { authType: 'x-api-key' }
    ] satisfies Record<'authType', keyof typeof ownersAuthHeaders>[])(
      'when authenticated as owner with $authType',
      ({ authType }) => {
        it('returns status 400 with validation_error', async () => {
          const response = await server.inject({
            method: 'POST',
            url: `/v2/orgs/${ownersOrganization.slug}/invites`,
            headers: { [authType]: ownersAuthHeaders[authType] }
          })

          expect(response.statusCode).toBe(400)
          expect(response.json()).toEqual({
            type: 'validation_error',
            payload: {
              validation_error: {
                context: 'body',
                message:
                  'A validation error occurred when validating the body.',
                errors: {
                  body: {
                    $root: 'must be an object'
                  }
                }
              }
            }
          })
        })

        describe('when payload is valid', () => {
          beforeEach(() => {
            jest
              .spyOn(NotificationService, 'sendEmailNotification')
              .mockImplementationOnce(() => {
                return Promise.resolve({
                  id: '123',
                  message: 'message queued',
                  status: 200,
                  details: 'success'
                })
              })
          })

          it('returns status 201 with invite', async () => {
            const payload = {
              name: 'Test User',
              email: 'test-User@sort.xyz',
              role_id: 0
            }

            const response = await server.inject({
              method: 'POST',
              url: `/v2/orgs/${ownersOrganization.slug}/invites`,
              headers: { [authType]: ownersAuthHeaders[authType] },
              payload
            })

            expect(response.statusCode).toBe(201)
            const json = response.json()
            expect(json).toEqual({
              type: 'create_organization_invite',
              payload: {
                organization_invite: {
                  id: expect.any(String),
                  created_at: expect.any(String),
                  created_by: owner.id,
                  email: payload.email.toLowerCase(),
                  name: payload.name,
                  role_id: payload.role_id,
                  organization_id: ownersOrganization.id,
                  status: 'pending'
                }
              }
            })
            expect(NotificationService.sendEmailNotification).toHaveBeenCalled()

            const invite = await OrganizationInviteService.getById(
              json.payload.organization_invite.id,
              ownersOrganization.slug
            )
            expect(invite?.email).toEqual(payload.email.toLowerCase())
          })

          describe('when mailgun fails', () => {
            it('removes the invite db record and returns status 500', async () => {
              const mockRemoveById = jest.fn()
              jest
                .spyOn(OrganizationInviteService, 'removeById')
                .mockImplementationOnce(mockRemoveById)

              jest
                .spyOn(NotificationService, 'sendOrgInviteEmail')
                .mockImplementationOnce(() => {
                  throw new Error('mailgun failed us all!')
                })

              const payload = {
                name: 'Test User',
                email: 'test-user@sort.xyz',
                role_id: 0
              }

              const response = await server.inject({
                method: 'POST',
                url: `/v2/orgs/${ownersOrganization.slug}/invites`,
                headers: { [authType]: ownersAuthHeaders[authType] },
                payload
              })

              expect(response.statusCode).toBe(500)
              expect(mockRemoveById).toHaveBeenCalled()
            })
          })
        })
      }
    )
  })

  describe('/:id', () => {
    describe('GET', () => {
      describe('when no authorization headers are passed', () => {
        it('returns status 401 with error', async () => {
          const response = await server.inject({
            method: 'GET',
            url: `/v2/orgs/${ownersOrganization.slug}/invites/${ownersOrganizationInvite.id}`
          })

          expect(response.statusCode).toBe(401)
          expect(response.json()).toEqual({
            type: 'error',
            payload: {
              error: {
                message: 'Not Authorized.'
              }
            }
          })
        })
      })

      describe.each([
        { authType: 'authorization' },
        { authType: 'x-api-key' }
      ] satisfies Record<'authType', keyof typeof anotherOwnersAuthHeaders>[])(
        'when authenticated as another owner with $authType',
        ({ authType }) => {
          it('returns status 400 with error', async () => {
            const response = await server.inject({
              method: 'GET',
              url: `/v2/orgs/${ownersOrganization.slug}/invites/${ownersOrganizationInvite.id}`,
              headers: { [authType]: anotherOwnersAuthHeaders[authType] }
            })

            expect(response.statusCode).toBe(400)
            expect(response.json()).toEqual({
              type: 'validation_error',
              payload: {
                validation_error: {
                  context: 'querystring',
                  errors: {
                    query: {
                      email: 'is required'
                    }
                  },
                  message:
                    'A validation error occurred when validating the querystring.'
                }
              }
            })
          })

          describe('when email of invite is specified', () => {
            it('returns status 200 with organizationInvite', async () => {
              const response = await server.inject({
                method: 'GET',
                query: {
                  email: ownersOrganizationInvite.email
                },
                url: `/v2/orgs/${ownersOrganization.slug}/invites/${ownersOrganizationInvite.id}`,
                headers: { [authType]: anotherOwnersAuthHeaders[authType] }
              })

              expect(response.statusCode).toBe(200)
              expect(response.json()).toEqual({
                type: 'get_organization_invite',
                payload: {
                  organization: {
                    ...ownersOrganization,
                    created_at: ownersOrganization.created_at.toJSON()
                  },
                  organization_invite: {
                    ...ownersOrganizationInvite,
                    created_at: ownersOrganizationInvite.created_at.toJSON()
                  }
                }
              })
            })
          })

          describe('when email of invite is specified and includes uppercase', () => {
            it('returns status 200 with organizationInvite', async () => {
              const response = await server.inject({
                method: 'GET',
                query: {
                  email: ownersOrganizationInvite.email.toUpperCase()
                },
                url: `/v2/orgs/${ownersOrganization.slug}/invites/${ownersOrganizationInvite.id}`,
                headers: { [authType]: anotherOwnersAuthHeaders[authType] }
              })

              expect(response.statusCode).toBe(200)
              expect(response.json()).toEqual({
                type: 'get_organization_invite',
                payload: {
                  organization: {
                    ...ownersOrganization,
                    created_at: ownersOrganization.created_at.toJSON()
                  },
                  organization_invite: {
                    ...ownersOrganizationInvite,
                    created_at: ownersOrganizationInvite.created_at.toJSON()
                  }
                }
              })
            })
          })
        }
      )
    })

    describe('PATCH', () => {
      describe('when no authorization headers are passed', () => {
        it('returns status 401 with error', async () => {
          const response = await server.inject({
            method: 'PATCH',
            url: `/v2/orgs/${ownersOrganization.slug}/invites/${ownersOrganizationInvite.id}`
          })

          expect(response.statusCode).toBe(401)
          expect(response.json()).toEqual({
            type: 'error',
            payload: {
              error: {
                message: 'Not Authorized.'
              }
            }
          })
        })
      })

      describe.each([
        { authType: 'authorization' },
        { authType: 'x-api-key' }
      ] satisfies Record<'authType', keyof typeof usersAuthHeaders>[])(
        'when authenticated as user with $authType',
        ({ authType }) => {
          describe('when payload status is accepted', () => {
            it('returns status 200 with invite', async () => {
              const payload = {
                status: 'accepted',
                email: ownersOrganizationInvite.email
              } satisfies Partial<typeof ownersOrganizationInvite>

              const response = await server.inject({
                method: 'PATCH',
                url: `/v2/orgs/${ownersOrganization.slug}/invites/${ownersOrganizationInvite.id}`,
                headers: { [authType]: usersAuthHeaders[authType] },
                payload
              })

              expect(response.statusCode).toBe(200)
              expect(response.json()).toEqual({
                type: 'success',
                payload: {
                  success: {
                    message: 'Successfully updated organization invite.'
                  }
                }
              })
            })

            describe('when invite is from another user', () => {
              it('returns status 404 with error', async () => {
                const payload = {
                  status: 'accepted',
                  email: anotherOwnersOrganizationInvite.email
                } satisfies Partial<typeof anotherOwnersOrganizationInvite>
                const response = await server.inject({
                  method: 'PATCH',
                  url: `/v2/orgs/${ownersOrganization.slug}/invites/${anotherOwnersOrganizationInvite.id}`,
                  headers: { [authType]: usersAuthHeaders[authType] },
                  payload
                })

                expect(response.statusCode).toBe(404)
                expect(response.json()).toEqual({
                  type: 'error',
                  payload: {
                    error: {
                      message: 'Organization invite not found.'
                    }
                  }
                })
              })
            })
          })
        }
      )

      describe.each([
        { authType: 'authorization' },
        { authType: 'x-api-key' }
      ] satisfies Record<'authType', keyof typeof anotherOwnersAuthHeaders>[])(
        'when authenticated as another owner with $authType',
        ({ authType }) => {
          it('returns status 400 with ValidationError', async () => {
            const response = await server.inject({
              method: 'PATCH',
              url: `/v2/orgs/${ownersOrganization.slug}/invites/${ownersOrganizationInvite.id}`,
              headers: { [authType]: anotherOwnersAuthHeaders[authType] }
            })

            expect(response.statusCode).toBe(400)
            expect(response.json()).toEqual({
              type: 'validation_error',
              payload: {
                validation_error: {
                  context: 'body',
                  message:
                    'A validation error occurred when validating the body.',
                  errors: {
                    body: {
                      $root: 'must be an object'
                    }
                  }
                }
              }
            })
          })

          describe('when payload is valid', () => {
            it('returns status 200 with invite', async () => {
              const payload = {
                status: 'accepted',
                email: ownersOrganizationInvite.email
              } satisfies Partial<typeof ownersOrganizationInvite>
              const response = await server.inject({
                method: 'PATCH',
                url: `/v2/orgs/${ownersOrganization.slug}/invites/${ownersOrganizationInvite.id}`,
                headers: { [authType]: anotherOwnersAuthHeaders[authType] },
                payload
              })

              expect(response.statusCode).toBe(200)
              expect(response.json()).toEqual({
                type: 'success',
                payload: {
                  success: {
                    message: 'Successfully updated organization invite.'
                  }
                }
              })
            })
          })
        }
      )

      describe.each([
        { authType: 'authorization' },
        { authType: 'x-api-key' }
      ] satisfies Record<'authType', keyof typeof ownersAuthHeaders>[])(
        'when authenticated as owner with $authType',
        ({ authType }) => {
          it('returns status 400 with ValidationError', async () => {
            const response = await server.inject({
              method: 'PATCH',
              url: `/v2/orgs/${ownersOrganization.slug}/invites/${ownersOrganizationInvite.id}`,
              headers: { [authType]: ownersAuthHeaders[authType] }
            })

            expect(response.statusCode).toBe(400)
            expect(response.json()).toEqual({
              type: 'validation_error',
              payload: {
                validation_error: {
                  context: 'body',
                  message:
                    'A validation error occurred when validating the body.',
                  errors: {
                    body: {
                      $root: 'must be an object'
                    }
                  }
                }
              }
            })
          })

          describe('when payload status is rescinded', () => {
            it('returns status 200 with invite', async () => {
              const payload = {
                status: 'rescinded',
                email: ownersOrganizationInvite.email
              } satisfies Partial<typeof ownersOrganizationInvite>
              const response = await server.inject({
                method: 'PATCH',
                url: `/v2/orgs/${ownersOrganization.slug}/invites/${ownersOrganizationInvite.id}`,
                headers: { [authType]: ownersAuthHeaders[authType] },
                payload
              })

              expect(response.statusCode).toBe(200)
              expect(response.json()).toEqual({
                type: 'success',
                payload: {
                  success: {
                    message: 'Successfully updated organization invite.'
                  }
                }
              })
            })

            describe('when invite is from another user', () => {
              it('returns status 404 with error', async () => {
                const payload = {
                  status: 'accepted',
                  email: anotherOwnersOrganizationInvite.email
                } satisfies Partial<typeof anotherOwnersOrganizationInvite>
                const response = await server.inject({
                  method: 'PATCH',
                  url: `/v2/orgs/${ownersOrganization.slug}/invites/${anotherOwnersOrganizationInvite.id}`,
                  headers: { [authType]: ownersAuthHeaders[authType] },
                  payload
                })

                expect(response.statusCode).toBe(404)
                expect(response.json()).toEqual({
                  type: 'error',
                  payload: {
                    error: {
                      message: 'Organization invite not found.'
                    }
                  }
                })
              })
            })
          })
        }
      )
    })
  })
})
