import { randomUUID } from 'crypto'

import { UserMock } from '@sort/shared/mocks/user.mock'
import * as UserService from '@sort/shared/services/user.service'
import * as usernameGenerator from 'friendly-username-generator'

import { config } from '../../../config/bootstrap'
import * as KyselyService from '../../../global/services/kysely.service'
import { getTestServer } from '../../../global/utils/test.util'
import { auth0JwtMock, auth0JwtDecodedMock } from '../../mocks/jwt.mock'
import {
  SortHubJwt,
  EmailVerificationJwt,
  jwtRegExp,
  auth0JwtTestSign
} from '../../utils/jwt.util'
import { testInvalidAuth0AuthHeaders } from '../../utils/test.util'

import type { FastifyInstance } from 'fastify'

describe('v2/routes/special/users.route', () => {
  const userMock = new UserMock()

  let server: FastifyInstance
  beforeAll(async () => {
    server = await getTestServer()
    KyselyService.createKysely()
    await UserService.removeUserById(auth0JwtDecodedMock.sub)
  })

  afterAll(async () => {
    await userMock.removeAll()
    await KyselyService.disconnectKysely()
  })

  describe('initialize_user operation', () => {
    testInvalidAuth0AuthHeaders({
      method: 'PUT',
      url: '/v2/special/users'
    })

    describe('when the user does not exist', () => {
      it('creates the entity', async () => {
        const response = await server.inject({
          headers: {
            authorization: `bearer ${auth0JwtMock}`
          },
          method: 'PUT',
          url: '/v2/special/users'
        })

        expect(response.statusCode).toBe(200)

        const body = response.json()
        expect(body).toEqual({
          type: 'initialize_user',
          payload: {
            jwt: expect.stringMatching(jwtRegExp),
            profile: {
              id: auth0JwtDecodedMock.sub,
              name: expect.any(String),
              email: auth0JwtDecodedMock.email,
              email_verified: auth0JwtDecodedMock.email_verified,
              picture: auth0JwtDecodedMock.picture,
              username: expect.any(String)
            }
          }
        })

        const jwt = await SortHubJwt.verify(body.payload.jwt)
        expect(jwt).toEqual({
          aud: 'sort.xyz',
          iss: 'sort.xyz',
          sub: 'session',
          exp: expect.any(Number),
          iat: expect.any(Number),
          user: {
            id: auth0JwtDecodedMock.sub
          }
        })

        const user = await UserService.getUserById(auth0JwtDecodedMock.sub)
        expect(user).toEqual({
          id: auth0JwtDecodedMock.sub,
          username: expect.any(String),
          username_discord: null,
          password_reset_at: null,
          administrator: false,
          name: expect.any(String),
          email: auth0JwtDecodedMock.email,
          email_verified: auth0JwtDecodedMock.email_verified,
          picture: auth0JwtDecodedMock.picture,
          terms_accepted_at: expect.any(Date),
          login_count: 1
        })

        expect(user?.name).toEqual(user?.username)
        expect(user?.name).not.toEqual(auth0JwtDecodedMock.email)
      })

      afterAll(async () => {
        await UserService.removeUserById(auth0JwtDecodedMock.sub)
      })
    })

    describe('when the user id already exists', () => {
      it('fetches the existing entity', async () => {
        const mockedUser = userMock.create({ id: auth0JwtDecodedMock.sub })
        await UserService.createUser(mockedUser)

        const response = await server.inject({
          headers: {
            authorization: `bearer ${auth0JwtMock}`
          },
          method: 'PUT',
          url: '/v2/special/users'
        })

        expect(response.statusCode).toBe(200)

        const body = response.json()
        expect(body).toEqual({
          type: 'initialize_user',
          payload: {
            jwt: expect.stringMatching(jwtRegExp),
            profile: {
              id: mockedUser.id,
              name: mockedUser.name,
              email: mockedUser.email,
              email_verified: mockedUser.email_verified,
              picture: mockedUser.picture,
              username: mockedUser.username
            }
          }
        })

        const jwt = await SortHubJwt.verify(body.payload.jwt)
        expect(jwt).toEqual({
          aud: 'sort.xyz',
          iss: 'sort.xyz',
          sub: 'session',
          exp: expect.any(Number),
          iat: expect.any(Number),
          user: {
            id: auth0JwtDecodedMock.sub
          }
        })

        const user = await UserService.getUserById(auth0JwtDecodedMock.sub)
        expect(user).toEqual({
          ...mockedUser,
          terms_accepted_at: expect.any(Date),
          login_count: 1
        })
      })

      afterAll(async () => {
        await UserService.removeUserById(auth0JwtDecodedMock.sub)
      })
    })

    describe('when the user id does not exist but the generated username already exists', () => {
      const id = `${auth0JwtDecodedMock.sub}-${Math.random()}`

      it('creates the user with a different username', async () => {
        const mockedUser = userMock.create({
          id,
          username: 'zelda'
        })
        await UserService.createUser(mockedUser)

        jest
          .spyOn(usernameGenerator, 'generateUsername')
          .mockReturnValueOnce(mockedUser.username)

        const response = await server.inject({
          headers: {
            authorization: `bearer ${auth0JwtMock}`
          },
          method: 'PUT',
          url: '/v2/special/users'
        })

        expect(response.statusCode).toBe(200)

        const body = response.json()
        expect(body).toEqual({
          type: 'initialize_user',
          payload: {
            jwt: expect.stringMatching(jwtRegExp),
            profile: {
              id: auth0JwtDecodedMock.sub,
              name: expect.not.stringMatching(/^zelda$/),
              email: auth0JwtDecodedMock.email,
              email_verified: auth0JwtDecodedMock.email_verified,
              picture: auth0JwtDecodedMock.picture,
              username: expect.not.stringMatching(/^zelda$/)
            }
          }
        })

        const jwt = await SortHubJwt.verify(body.payload.jwt)
        expect(jwt).toEqual({
          aud: 'sort.xyz',
          iss: 'sort.xyz',
          sub: 'session',
          exp: expect.any(Number),
          iat: expect.any(Number),
          user: {
            id: auth0JwtDecodedMock.sub
          }
        })

        const user = await UserService.getUserById(auth0JwtDecodedMock.sub)
        expect(user).toEqual({
          id: auth0JwtDecodedMock.sub,
          username: expect.not.stringMatching(/^zelda$/),
          username_discord: null,
          administrator: false,
          password_reset_at: null,
          name: expect.not.stringMatching(/^zelda$/),
          email: auth0JwtDecodedMock.email,
          email_verified: auth0JwtDecodedMock.email_verified,
          picture: auth0JwtDecodedMock.picture,
          terms_accepted_at: expect.any(Date),
          login_count: 1
        })
      })

      afterAll(async () => {
        await UserService.removeUserById(id)
      })
    })

    describe('when the auth0 profile pic is too long', () => {
      const sub = `${auth0JwtDecodedMock.sub}-${Math.random()}`

      afterAll(async () => {
        await UserService.removeUserById(sub)
      })

      it('creates a gravatar url', async () => {
        const auth0JwtMockWithBigPic = {
          ...auth0JwtDecodedMock,
          picture: `https://example.com/${'x'.repeat(300)}.png`,
          sub
        }

        const auth0Jwt = auth0JwtTestSign(auth0JwtMockWithBigPic)

        const response = await server.inject({
          headers: {
            authorization: `bearer ${auth0Jwt}`
          },
          method: 'PUT',
          url: '/v2/special/users'
        })

        expect(response.statusCode).toBe(200)

        const body = response.json()
        expect(body).toEqual({
          type: 'initialize_user',
          payload: {
            jwt: expect.stringMatching(jwtRegExp),
            profile: {
              id: sub,
              name: expect.any(String),
              email: auth0JwtDecodedMock.email,
              email_verified: auth0JwtDecodedMock.email_verified,
              picture: expect.stringMatching(
                /^https:\/\/gravatar\.com\/avatar\/[a-z0-9]+\?s=48&d=https%3A%2F%2Fcdn\.auth0\.com%2Favatars%2Ft\.png&r=pg/
              ),
              username: expect.any(String)
            }
          }
        })
      })
    })

    describe('when a database error occurs', () => {
      describe('when creating the user', () => {
        it('returns an HTTP 500 error', async () => {
          jest.spyOn(UserService, 'createUser').mockImplementationOnce(() => {
            throw new Error('users_something')
          })

          const response = await server.inject({
            headers: {
              authorization: `bearer ${auth0JwtMock}`
            },
            method: 'PUT',
            url: '/v2/special/users'
          })

          expect(response.statusCode).toBe(500)
        })
      })
    })
  })

  describe('revoke_sessions operation', () => {
    describe('when secret does not match', () => {
      it('replies with 400', async () => {
        const res = await server.inject({
          method: 'POST',
          url: '/v2/special/users/revoke-sessions',
          body: {
            secret: 'wrong-secret',
            user_id: 'user|123'
          }
        })

        expect(res.json()).toEqual({
          type: 'error',
          payload: {
            error: {
              message: 'Invalid secret'
            }
          }
        })

        expect(res.statusCode).toBe(400)
      })
    })

    describe('when the user does not exist', () => {
      it('replies with 404', async () => {
        const res = await server.inject({
          method: 'POST',
          url: '/v2/special/users/revoke-sessions',
          body: {
            secret: config.SORT_SESSION_REVOKE_SECRET,
            user_id: 'i-do-not-exist'
          }
        })

        expect(res.json()).toEqual({
          type: 'error',
          payload: {
            error: {
              message: 'User not found.'
            }
          }
        })

        expect(res.statusCode).toBe(404)
      })
    })

    describe('when user exists', () => {
      const id = 'mr|revoke-sessions'

      beforeAll(async () => {
        const mockedUser = userMock.create({ id })
        await UserService.createUser(mockedUser)
      })

      afterAll(async () => {
        await UserService.removeUserById(id)
      })

      it('revokes their old Sort JWT tokens', async () => {
        const jwt1 = SortHubJwt.create({ user: { id } })

        await new Promise(resolve => setTimeout(resolve, 1000))

        const revokeRes = await server.inject({
          method: 'POST',
          url: '/v2/special/users/revoke-sessions',
          body: {
            secret: config.SORT_SESSION_REVOKE_SECRET,
            user_id: id
          }
        })

        expect(revokeRes.statusCode).toBe(200)

        const profileRes1 = await server.inject({
          method: 'GET',
          url: '/v2/my/profile',
          headers: {
            authorization: `bearer ${jwt1}`
          }
        })

        expect(profileRes1.statusCode).toBe(401)

        await new Promise(resolve => setTimeout(resolve, 1500))

        const jwt2 = SortHubJwt.create({ user: { id } })
        const profileRes2 = await server.inject({
          method: 'GET',
          url: '/v2/my/profile',
          headers: {
            authorization: `bearer ${jwt2}`
          }
        })

        expect(profileRes2.statusCode).toBe(200)
      })
    })
  })

  describe('verify_email operation', () => {
    describe('when the user email is already verified', () => {
      const id = 'mr|verify_email'
      const email = `mr-${randomUUID()}@sort.xyz`

      beforeAll(async () => {
        const mockedUser = userMock.create({
          id,
          email,
          email_verified: true
        })
        await UserService.createUser(mockedUser)
      })

      afterAll(async () => {
        await UserService.removeUserById(id)
      })

      it('replies with 400', async () => {
        const sorthubJwt = SortHubJwt.create({
          user: { id }
        })
        const emailJwt = EmailVerificationJwt.create({
          user: { id, email }
        })
        const response = await server.inject({
          headers: {
            authorization: `bearer ${sorthubJwt}`
          },
          method: 'PATCH',
          body: {
            key: emailJwt,
            subscribe: true
          },
          url: '/v2/special/users/verify-email'
        })

        expect(response.json()).toEqual({
          type: 'validation_error',
          payload: {
            validation_error: {
              message: 'Email already verified.',
              context: 'body',
              errors: {
                body: {
                  key: 'Email already verified.'
                }
              }
            }
          }
        })
        expect(response.statusCode).toBe(400)
      })
    })

    describe('when an invalid Email Confirmation JWT is provided', () => {
      it('replies with 400', async () => {
        const mockedUser = userMock.create()
        await UserService.createUser(mockedUser)

        const sorthubJwt = SortHubJwt.create({
          user: { id: mockedUser.id }
        })

        const response = await server.inject({
          headers: {
            authorization: `bearer ${sorthubJwt}`
          },
          method: 'PATCH',
          body: {
            key: sorthubJwt,
            subscribe: true
          },
          url: '/v2/special/users/verify-email'
        })

        expect(response.json()).toEqual({
          type: 'validation_error',
          payload: {
            validation_error: {
              message: 'Invalid key.',
              context: 'body',
              errors: {
                body: {
                  key: 'Invalid key.'
                }
              }
            }
          }
        })
        expect(response.statusCode).toBe(400)
      })
    })

    describe('when Email Confirmation JWT does not match the user', () => {
      it('replies with 400', async () => {
        const mockedUser = userMock.create()
        await UserService.createUser(mockedUser)

        const sorthubJwt = SortHubJwt.create({
          user: { id: mockedUser.id }
        })

        const emailJwt = EmailVerificationJwt.create({
          user: {
            id: randomUUID(),
            email: `${randomUUID()}@sort.xyz`
          }
        })

        const response = await server.inject({
          headers: {
            authorization: `bearer ${sorthubJwt}`
          },
          method: 'PATCH',
          body: {
            key: emailJwt,
            subscribe: true
          },
          url: '/v2/special/users/verify-email'
        })

        expect(response.json()).toEqual({
          type: 'validation_error',
          payload: {
            validation_error: {
              message:
                'This key does not match your email address. Are you logged in with the correct account?',
              context: 'body',
              errors: {
                body: {
                  key: 'This key does not match your email address. Are you logged in with the correct account?'
                }
              }
            }
          }
        })
        expect(response.statusCode).toBe(400)
      })
    })

    describe('success cases', () => {
      let user: Awaited<ReturnType<typeof UserService.createUser>>
      let sorthubJwt: string
      let emailJwt: string
      beforeEach(async () => {
        const mockedUser = userMock.create({ email_verified: false })
        user = await UserService.createUser(mockedUser)

        sorthubJwt = SortHubJwt.create({ user: { id: user.id } })
        emailJwt = EmailVerificationJwt.create({
          user: {
            id: user.id,
            email: user.email!
          }
        })
      })

      describe('when subscribing', () => {
        describe('when user is already on mailing list', () => {
          it('marks email verified', async () => {
            const mockAddToList = jest
              .spyOn(UserService, 'addToCustomerMailingList')
              .mockImplementation(() => Promise.resolve({ added: false }))
            const mockRmFromList = jest
              .spyOn(UserService, 'removeFromCustomerMailingList')
              .mockImplementation(() => Promise.resolve(undefined))

            const response = await server.inject({
              headers: {
                authorization: `bearer ${sorthubJwt}`
              },
              method: 'PATCH',
              body: {
                key: emailJwt,
                subscribe: true
              },
              url: '/v2/special/users/verify-email'
            })

            expect(response.json()).toEqual({
              type: 'success',
              payload: {
                success: {
                  message: 'You have successfully verified your email address.'
                }
              }
            })
            expect(response.statusCode).toBe(200)

            expect(mockRmFromList).toHaveBeenCalledTimes(0)
            expect(mockAddToList).toHaveBeenCalledTimes(1)
            const u = await UserService.getUserById(user.id)
            expect(u?.email_verified).toBe(true)
          })
        })

        describe('when user is not already on mailing list', () => {
          it('subscribes the user and marks email verified', async () => {
            const mockAddToList = jest
              .spyOn(UserService, 'addToCustomerMailingList')
              .mockImplementation(() => Promise.resolve({ added: true }))
            const mockRmFromList = jest
              .spyOn(UserService, 'removeFromCustomerMailingList')
              .mockImplementation(() => Promise.resolve(undefined))

            const response = await server.inject({
              headers: {
                authorization: `bearer ${sorthubJwt}`
              },
              method: 'PATCH',
              body: {
                key: emailJwt,
                subscribe: true
              },
              url: '/v2/special/users/verify-email'
            })

            expect(response.json()).toEqual({
              type: 'success',
              payload: {
                success: {
                  message: 'You have successfully verified your email address.'
                }
              }
            })
            expect(response.statusCode).toBe(200)
            expect(mockRmFromList).toHaveBeenCalledTimes(0)
            expect(mockAddToList).toHaveBeenCalledTimes(1)
            const u = await UserService.getUserById(user.id)
            expect(u?.email_verified).toBe(true)
          })
        })
      })

      describe('when not subscribing', () => {
        describe('when user is on mailing list', () => {
          it('unsubscribes the user and marks email verified', async () => {
            const mockAddToList = jest
              .spyOn(UserService, 'addToCustomerMailingList')
              .mockImplementation(() => Promise.resolve({ added: true }))
            const mockRmFromList = jest
              .spyOn(UserService, 'removeFromCustomerMailingList')
              .mockImplementation(() => Promise.resolve(undefined))

            const response = await server.inject({
              headers: {
                authorization: `bearer ${sorthubJwt}`
              },
              method: 'PATCH',
              body: {
                key: emailJwt,
                subscribe: false
              },
              url: '/v2/special/users/verify-email'
            })

            expect(response.json()).toEqual({
              type: 'success',
              payload: {
                success: {
                  message: 'You have successfully verified your email address.'
                }
              }
            })
            expect(response.statusCode).toBe(200)
            expect(mockAddToList).toHaveBeenCalledTimes(0)
            expect(mockRmFromList).toHaveBeenCalledTimes(1)
            const u = await UserService.getUserById(user.id)
            expect(u?.email_verified).toBe(true)
          })
        })

        describe('when user is not on mailing list', () => {
          it('marks email verified', async () => {
            const mockAddToList = jest
              .spyOn(UserService, 'addToCustomerMailingList')
              .mockImplementation(() => Promise.resolve({ added: false }))
            const mockRmFromList = jest
              .spyOn(UserService, 'removeFromCustomerMailingList')
              .mockImplementation(() => Promise.resolve(undefined))

            const response = await server.inject({
              headers: {
                authorization: `bearer ${sorthubJwt}`
              },
              method: 'PATCH',
              body: {
                key: emailJwt,
                subscribe: false
              },
              url: '/v2/special/users/verify-email'
            })

            expect(response.json()).toEqual({
              type: 'success',
              payload: {
                success: {
                  message: 'You have successfully verified your email address.'
                }
              }
            })
            expect(response.statusCode).toBe(200)
            expect(mockAddToList).toHaveBeenCalledTimes(0)
            expect(mockRmFromList).toHaveBeenCalledTimes(1)
            const u = await UserService.getUserById(user.id)
            expect(u?.email_verified).toBe(true)
          })
        })
      })
    })
  })
})
