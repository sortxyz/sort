import {
  dateFormat,
  uuidFormat,
  apiKeyFormat
} from '@sort/shared/constants/type-mask.constant'
import { UserMock } from '@sort/shared/mocks/user.mock'
import * as NotificationService from '@sort/shared/services/notification.service'
import * as UserService from '@sort/shared/services/user.service'

import * as KyselyService from '../../global/services/kysely.service'
import { getTestServer } from '../../global/utils/test.util'
import { createSortJwt } from '../utils/jwt.util'
import { testInvalidSortAuthHeaders } from '../utils/test.util'

import type { FastifyInstance } from 'fastify'

describe('v2/routes/users.route', () => {
  const userMock = new UserMock()

  let server: FastifyInstance
  beforeAll(async () => {
    server = await getTestServer()
    KyselyService.createKysely()
  })

  afterAll(async () => {
    await userMock.removeAll()
    await KyselyService.disconnectKysely()
  })

  describe('profile', () => {
    describe('get_my_profile operation', () => {
      testInvalidSortAuthHeaders({
        method: 'GET',
        url: '/v2/my/profile'
      })

      describe('when user exists', () => {
        const user = userMock.create()

        beforeAll(async () => {
          await UserService.createUser(user)
        })

        it('returns the user profile', async () => {
          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
            method: 'GET',
            url: '/v2/my/profile'
          })

          expect(response.statusCode).toBe(200)

          const body = response.json()
          expect(body).toEqual({
            type: 'get_my_profile',
            payload: {
              profile: {
                id: user.id,
                name: user.name,
                email: user.email,
                email_verified: user.email_verified,
                picture: user.picture,
                username: user.username
              }
            }
          })
        })
      })

      describe('when a database error occurs', () => {
        it('replies with HTTP 500', async () => {
          let called = false
          jest
            .spyOn(UserService, 'getUserById')
            .mockImplementation(async id => {
              if (called) {
                throw new Error('fail')
              }
              called = true
              return userMock.create({ id })
            })

          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt('id')}` },
            method: 'GET',
            url: '/v2/my/profile'
          })

          expect(response.statusCode).toBe(500)
        })
      })
    })

    describe('update_my_profile operation', () => {
      testInvalidSortAuthHeaders({
        method: 'PATCH',
        url: '/v2/my/profile'
      })

      describe('validation', () => {
        const user = userMock.create()

        beforeAll(async () => {
          await UserService.createUser(user)
        })

        const failures = [
          {
            name: 'when name is too short',
            payload: { name: '' },
            errors: {
              name: 'must not have fewer than 1 characters'
            }
          },
          {
            name: 'when username is too short',
            payload: { username: '' },
            errors: {
              username: 'must not have fewer than 2 characters'
            }
          },
          {
            name: 'when name is too long',
            payload: { name: 'a'.repeat(257) },
            errors: { name: 'must not have more than 256 characters' }
          },
          {
            name: 'when username is too long',
            payload: { username: 'a'.repeat(129) },
            errors: { username: 'must not have more than 128 characters' }
          },
          {
            name: 'when picture is too long',
            payload: { picture: 'a'.repeat(181) },
            errors: { picture: 'must not have more than 180 characters' }
          },
          {
            name: 'when email is invalid',
            payload: { email: 'not-an-email-address' },
            errors: { email: 'must match format "email" (format)' }
          }
        ]

        describe.each(failures)('$name', ({ payload, errors }) => {
          it('returns HTTP 400', async () => {
            const response = await server.inject({
              headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
              method: 'PATCH',
              url: '/v2/my/profile',
              payload: {
                name: 'name',
                username: 'username',
                picture: 'https://sort.xyz/favicon.png',
                ...payload
              }
            })

            expect(response.statusCode).toBe(400)

            const body = response.json()
            expect(body).toEqual({
              type: 'validation_error',
              payload: {
                validation_error: {
                  message:
                    'A validation error occurred when validating the body.',
                  context: 'body',
                  errors: {
                    body: errors
                  }
                }
              }
            })
          })
        })
      })

      describe('success', () => {
        const user = userMock.create()

        beforeAll(async () => {
          await UserService.createUser(user)
        })

        it('returns the user profile', async () => {
          const payload = {
            name: 'new name',
            username: 'new-username',
            picture: 'https://sort.xyz/new.png',
            email: 'test-user-ci@sort.xyz'
          }

          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
            method: 'PATCH',
            url: '/v2/my/profile',
            payload
          })

          expect(response.statusCode).toBe(200)

          const body = response.json()
          expect(body).toEqual({
            type: 'update_my_profile',
            payload: {
              profile: {
                id: user.id,
                name: payload.name,
                email: payload.email,
                email_verified: user.email_verified,
                picture: payload.picture,
                username: payload.username
              }
            }
          })
        })
      })

      describe('when username is already taken', () => {
        const user1 = userMock.create()
        const user2 = userMock.create()

        beforeAll(async () => {
          await UserService.createUser(user1)
          await UserService.createUser(user2)
        })

        it('replies with HTTP 409', async () => {
          const payload = {
            username: user2.username
          }

          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(user1.id)}` },
            method: 'PATCH',
            url: '/v2/my/profile',
            payload
          })

          expect(response.statusCode).toBe(409)

          const body = response.json()
          expect(body).toEqual({
            type: 'error',
            payload: {
              error: {
                message: 'That username already exists.'
              }
            }
          })
        })
      })

      describe('when unexpected database error occurs', () => {
        const user = userMock.create()

        beforeAll(async () => {
          await UserService.createUser(user)
        })

        it('replies with HTTP 500', async () => {
          jest
            .spyOn(UserService, 'updateUserById')
            .mockImplementationOnce(async () => {
              throw new Error('fail')
            })

          const payload = {
            name: 'new name',
            picture: ''
          }

          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
            method: 'PATCH',
            url: '/v2/my/profile',
            payload
          })

          expect(response.statusCode).toBe(500)

          const body = response.json()
          expect(body).toEqual({
            type: 'error',
            payload: {
              error: {
                message: expect.stringMatching(
                  /^Internal server error. If the problem persists/
                )
              }
            }
          })
        })
      })
    })

    describe('delete_my_profile operation', () => {
      testInvalidSortAuthHeaders({
        method: 'DELETE',
        url: '/v2/my/profile'
      })

      describe('when user exists', () => {
        const user = userMock.create()

        beforeAll(async () => {
          await UserService.createUser(user)
        })

        it('replies with HTTP 501', async () => {
          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
            method: 'DELETE',
            url: '/v2/my/profile'
          })

          expect(response.statusCode).toBe(501)
        })
      })
    })

    describe('send_verification_email', () => {
      describe('when user does not have an email address', () => {
        it('replies with HTTP 409', async () => {
          const user = userMock.create({ email: null })
          await UserService.createUser(user)

          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
            method: 'POST',
            url: '/v2/my/profile/verify-email',
            payload: { email: null }
          })

          expect(response.json()).toEqual({
            type: 'error',
            payload: {
              error: {
                message: 'User does not have an email address.'
              }
            }
          })
          expect(response.statusCode).toBe(409)
        })
      })

      describe('when user has email address', () => {
        it('sends the verification email', async () => {
          const send = jest
            .spyOn(NotificationService, 'sendVerificationEmail')
            .mockResolvedValue(undefined)

          const user = userMock.create()
          await UserService.createUser(user)

          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
            method: 'POST',
            url: '/v2/my/profile/verify-email',
            payload: { email: user.email }
          })

          expect(response.json()).toEqual({
            type: 'success',
            payload: {
              success: { message: 'Verification email sent.' }
            }
          })
          expect(response.statusCode).toBe(200)
          expect(send).toHaveBeenCalled()
        })
      })
    })
  })

  describe('api keys', () => {
    const createAPIKey = async ({
      userId,
      summary
    }: {
      userId: string
      summary?: string
    }) => {
      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(userId)}` },
        method: 'POST',
        url: '/v2/my/api-keys',
        payload: {
          summary
        }
      })

      expect(response.statusCode).toBe(201)
      expect(response.json()).toEqual({
        type: 'create_api_key',
        payload: {
          api_key: {
            id: expect.stringMatching(uuidFormat),
            api_key: expect.stringMatching(apiKeyFormat),
            summary: summary ?? null,
            created_at: expect.stringMatching(dateFormat),
            updated_at: expect.stringMatching(dateFormat)
          }
        }
      })
      return response.json().payload.api_key
    }

    describe('create_api_key operation', () => {
      const user = userMock.create()

      beforeAll(async () => {
        await UserService.createUser(user)
      })

      testInvalidSortAuthHeaders({
        method: 'POST',
        url: '/v2/my/api-keys'
      })

      describe('validation', () => {
        const failures = [
          {
            name: 'when summary is too long',
            payload: { summary: 't'.repeat(257) },
            errors: {
              summary: 'must not have more than 256 characters'
            }
          }
        ]

        describe.each(failures)('$name', ({ payload, errors }) => {
          it('returns HTTP 400', async () => {
            const response = await server.inject({
              headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
              method: 'POST',
              url: '/v2/my/api-keys',
              payload: {
                ...payload
              }
            })

            expect(response.statusCode).toBe(400)

            const body = response.json()
            expect(body).toEqual({
              type: 'validation_error',
              payload: {
                validation_error: {
                  message:
                    'A validation error occurred when validating the body.',
                  context: 'body',
                  errors: {
                    body: errors
                  }
                }
              }
            })
          })
        })
      })

      describe('success', () => {
        it('creates an api key', async () => {
          await createAPIKey({ userId: user.id, summary: 'Mr. Automation' })
        })
      })
    })

    describe('list_api_keys operation', () => {
      const user = userMock.create()

      beforeAll(async () => {
        await UserService.createUser(user)
      })

      testInvalidSortAuthHeaders({
        method: 'GET',
        url: '/v2/my/api-keys'
      })

      it("replies with all of the user's api keys", async () => {
        const apiKey1 = await createAPIKey({ userId: user.id })
        const apiKey2 = await createAPIKey({ userId: user.id })

        const response = await server.inject({
          headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
          method: 'GET',
          url: '/v2/my/api-keys'
        })

        expect(response.statusCode).toBe(200)

        delete apiKey1.api_key
        delete apiKey2.api_key

        const json = response.json()
        expect(json).toEqual({
          type: 'list_api_keys',
          payload: {
            api_keys: expect.arrayContaining([
              expect.objectContaining(apiKey1),
              expect.objectContaining(apiKey2)
            ])
          }
        })
        expect(json.payload.api_keys.length).toEqual(2)
      })
    })

    describe('update_api_key operation', () => {
      const user = userMock.create()

      beforeAll(async () => {
        await UserService.createUser(user)
      })

      testInvalidSortAuthHeaders({
        method: 'PATCH',
        url: '/v2/my/api-keys/{id}'
      })

      describe('validation', () => {
        const failures = [
          {
            name: 'when summary is too long',
            payload: { summary: 't'.repeat(257) },
            errors: {
              summary: 'must not have more than 256 characters'
            }
          }
        ]

        describe.each(failures)('$name', ({ payload, errors }) => {
          it('returns HTTP 400', async () => {
            const apiKey = await createAPIKey({ userId: user.id })

            const response = await server.inject({
              headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
              method: 'PATCH',
              url: `/v2/my/api-keys/${apiKey.id}`,
              payload: {
                ...payload
              }
            })

            expect(response.statusCode).toBe(400)

            const body = response.json()
            expect(body).toEqual({
              type: 'validation_error',
              payload: {
                validation_error: {
                  message:
                    'A validation error occurred when validating the body.',
                  context: 'body',
                  errors: {
                    body: errors
                  }
                }
              }
            })
          })
        })
      })

      describe('success', () => {
        it('updates an api key', async () => {
          const apiKey = await createAPIKey({ userId: user.id })

          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
            method: 'PATCH',
            url: `/v2/my/api-keys/${apiKey.id}`,
            payload: {
              summary: 'updated summary'
            }
          })

          expect(response.statusCode).toBe(200)

          const json = response.json()
          expect(json).toEqual({
            type: 'update_api_key',
            payload: {
              api_key: {
                id: apiKey.id,
                summary: 'updated summary',
                created_at: apiKey.created_at,
                updated_at: expect.not.stringContaining(apiKey.updated_at)
              }
            }
          })
        })
      })
    })

    describe('delete_api_key operation', () => {
      const user = userMock.create()

      beforeAll(async () => {
        await UserService.createUser(user)
      })

      testInvalidSortAuthHeaders({
        method: 'DELETE',
        url: '/v2/my/api-keys/{id}'
      })

      it('works', async () => {
        const apiKey = await createAPIKey({ userId: user.id })

        const response = await server.inject({
          headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
          method: 'DELETE',
          url: `/v2/my/api-keys/${apiKey.id}`
        })

        expect(response.statusCode).toBe(200)

        const json = response.json()
        expect(json).toEqual({
          type: 'success',
          payload: {
            success: { message: 'API key deleted successfully' }
          }
        })

        const keysResponse = await server.inject({
          headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
          method: 'GET',
          url: '/v2/my/api-keys'
        })

        expect(keysResponse.json()).toEqual({
          type: 'list_api_keys',
          payload: {
            api_keys: []
          }
        })
      })
    })
  })

  describe('email subscriptions', () => {
    describe('list_email_subscriptions operation', () => {
      it('returns the users email subscriptions', async () => {
        const user = userMock.create()
        await UserService.createUser(user)

        const result = [
          {
            name: 'newsletter' as const,
            email: user.email!,
            subscribed: true
          }
        ]

        jest
          .spyOn(UserService, 'getMailingListSubscriptions')
          .mockImplementationOnce(() => Promise.resolve(result))

        const response = await server.inject({
          headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
          method: 'GET',
          url: '/v2/my/email/subscriptions'
        })

        const body = response.json()
        expect(body).toEqual({
          type: 'list_email_subscriptions',
          payload: {
            subscriptions: result
          }
        })

        expect(response.statusCode).toBe(200)
      })
    })

    describe('update_email_subscriptions operation', () => {
      describe('when user email is not set', () => {
        it('replies with HTTP 409', async () => {
          const user = userMock.create({ email: null })
          await UserService.createUser(user)

          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
            method: 'PATCH',
            url: '/v2/my/email/subscriptions',
            payload: {
              subscriptions: [
                { name: 'newsletter', email: '30@sort.xyz', subscribed: true }
              ]
            }
          })

          expect(response.json()).toEqual({
            type: 'error',
            payload: {
              error: {
                message: 'User must have an email address before subscribing.'
              }
            }
          })
          expect(response.statusCode).toBe(409)
        })
      })

      describe('when user email is not verified', () => {
        it('replies with HTTP 409', async () => {
          const user = userMock.create({ email_verified: false })
          await UserService.createUser(user)

          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
            method: 'PATCH',
            url: '/v2/my/email/subscriptions',
            payload: {
              subscriptions: [
                { name: 'newsletter', email: user.email, subscribed: true }
              ]
            }
          })

          expect(response.json()).toEqual({
            type: 'error',
            payload: {
              error: {
                message: 'Email address must be verified before subscribing.'
              }
            }
          })
          expect(response.statusCode).toBe(409)
        })
      })

      describe('when subscribing', () => {
        it('updates the email subscriptions', async () => {
          const user = userMock.create({ email_verified: true })
          await UserService.createUser(user)

          const result = [
            {
              name: 'newsletter' as const,
              email: user.email!,
              subscribed: true
            }
          ]

          jest
            .spyOn(UserService, 'addToCustomerMailingList')
            .mockImplementationOnce(() => Promise.resolve({ added: true }))

          jest
            .spyOn(UserService, 'getMailingListSubscriptions')
            .mockImplementationOnce(() => Promise.resolve(result))

          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
            method: 'PATCH',
            url: '/v2/my/email/subscriptions',
            payload: {
              subscriptions: [
                { name: 'newsletter', email: user.email, subscribed: true }
              ]
            }
          })

          const body = response.json()
          expect(body).toEqual({
            type: 'update_email_subscriptions',
            payload: {
              subscriptions: result
            }
          })

          expect(response.statusCode).toBe(200)
        })
      })

      describe('when unsubscribing', () => {
        it('updates the email subscriptions', async () => {
          const user = userMock.create({ email_verified: true })
          await UserService.createUser(user)

          const result = [
            {
              name: 'newsletter' as const,
              email: user.email!,
              subscribed: false
            }
          ]

          jest
            .spyOn(UserService, 'removeFromCustomerMailingList')
            .mockImplementationOnce(() => Promise.resolve(undefined))

          jest
            .spyOn(UserService, 'getMailingListSubscriptions')
            .mockImplementationOnce(() => Promise.resolve(result))

          const response = await server.inject({
            headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
            method: 'PATCH',
            url: '/v2/my/email/subscriptions',
            payload: {
              subscriptions: [
                { name: 'newsletter', email: user.email, subscribed: false }
              ]
            }
          })

          const body = response.json()
          expect(body).toEqual({
            type: 'update_email_subscriptions',
            payload: {
              subscriptions: result
            }
          })

          expect(response.statusCode).toBe(200)
        })
      })
    })
  })
})
