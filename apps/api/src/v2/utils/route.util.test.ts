/* eslint-disable @typescript-eslint/no-explicit-any */

import { NotFoundError } from '@sort/shared/errors/not-found.error'
import { APIKeyMock } from '@sort/shared/mocks/apikey.mock'
import { UserMock } from '@sort/shared/mocks/user.mock'
import * as APIKeyService from '@sort/shared/services/apikey.service'
import * as UserService from '@sort/shared/services/user.service'

import { config } from '../../config/bootstrap'
import { createFastifyMockLogger } from '../mocks/fastify-logger.mock'

import { SortWebJwt, EmailVerificationJwt, auth0JwtTestSign } from './jwt.util'
import {
  checkAuthentication,
  notFoundHandler,
  serverErrorHandler
} from './route.util'

import type {
  authRestriction,
  checkAuthenticationSchema,
  notFoundHandlerSchema,
  serverErrorHandlerSchema
} from './route.util'
import type {
  FastifyReplyTypebox,
  FastifyRequestTypebox
} from '../types/fastify.type'
import type { FastifyBaseLogger, FastifyError } from 'fastify'

const { SORTUI_SERVICE_ACCOUNT_EMAIL } = config

describe('v2/utils/route.utils', () => {
  const userMock = new UserMock()
  const apiKeyMock = new APIKeyMock()

  beforeEach(async () => {
    jest.restoreAllMocks()
  })

  describe('checkAuthentication', () => {
    const notAuthorized = {
      type: 'error',
      payload: {
        error: { message: 'Not Authorized.' }
      }
    }

    it("returns unauthorized when there's no headers present in the request", async () => {
      const mockSend = jest.fn()
      const mockStatus = jest.fn(() => ({ send: mockSend }) as any)
      const spyGetUser = jest.spyOn(APIKeyService, 'getUserByAPIKey')

      await checkAuthentication()(
        {
          headers: null,
          log: {
            info: jest.fn(),
            error: jest.fn()
          } as Partial<FastifyBaseLogger>
        } as unknown as FastifyRequestTypebox<typeof checkAuthenticationSchema>,
        {
          send: mockSend,
          status: mockStatus
        } as unknown as FastifyReplyTypebox<typeof checkAuthenticationSchema>
      )

      expect(mockStatus).toHaveBeenCalledWith(401)
      expect(mockStatus).toHaveBeenCalledTimes(1)
      expect(mockSend).toHaveBeenCalledWith(notAuthorized)
      expect(mockSend).toHaveBeenCalledTimes(1)
      expect(spyGetUser).toHaveBeenCalledTimes(0)
    })

    it("returns unauthorized when there's no authorization or api key headers present in the request", async () => {
      const mockSend = jest.fn()
      const mockStatus = jest.fn(() => ({ send: mockSend }) as any)
      const spyGetUserById = jest.spyOn(UserService, 'getUserById')
      const spyGetUserByApiKey = jest.spyOn(APIKeyService, 'getUserByAPIKey')

      await checkAuthentication()(
        {
          headers: { 'Content-Type': 'application/json' },
          log: {
            info: jest.fn(),
            error: jest.fn()
          } as Partial<FastifyBaseLogger>
        } as unknown as FastifyRequestTypebox<typeof checkAuthenticationSchema>,
        {
          send: mockSend,
          status: mockStatus
        } as unknown as FastifyReplyTypebox<typeof checkAuthenticationSchema>
      )

      expect(mockStatus).toHaveBeenCalledWith(401)
      expect(mockStatus).toHaveBeenCalledTimes(1)
      expect(mockSend).toHaveBeenCalledWith(notAuthorized)
      expect(mockSend).toHaveBeenCalledTimes(1)
      expect(spyGetUserById).toHaveBeenCalledTimes(0)
      expect(spyGetUserByApiKey).toHaveBeenCalledTimes(0)
    })

    it('returns unauthorized when no api key is set and authorization bearer exists but is empty', async () => {
      const mockSend = jest.fn()
      const mockStatus = jest.fn(() => ({ send: mockSend }) as any)
      const spyGetUserById = jest.spyOn(UserService, 'getUserById')
      const spyGetUserByApiKey = jest.spyOn(APIKeyService, 'getUserByAPIKey')

      await checkAuthentication()(
        {
          headers: {
            authorization: 'bearer'
          },
          log: {
            info: jest.fn(),
            error: jest.fn()
          } as Partial<FastifyBaseLogger>
        } as unknown as FastifyRequestTypebox<typeof checkAuthenticationSchema>,
        {
          send: mockSend,
          status: mockStatus
        } as unknown as FastifyReplyTypebox<typeof checkAuthenticationSchema>
      )

      expect(mockStatus).toHaveBeenCalledWith(401)
      expect(mockSend).toHaveBeenCalledWith(notAuthorized)
      expect(spyGetUserById).toHaveBeenCalledTimes(0)
      expect(spyGetUserByApiKey).toHaveBeenCalledTimes(0)
    })

    it('returns unauthorized when authorization bearer is an invalid Sort JWT', async () => {
      const mockSend = jest.fn()
      const mockStatus = jest.fn(() => ({ send: mockSend }) as any)
      const spyGetUserById = jest.spyOn(UserService, 'getUserById')
      const spyGetUserByApiKey = jest.spyOn(APIKeyService, 'getUserByAPIKey')

      await checkAuthentication()(
        {
          headers: {
            authorization: `bearer ${auth0JwtTestSign({ id: 'h3ll0' })}`
          },
          log: {
            info: jest.fn(),
            error: jest.fn()
          } as Partial<FastifyBaseLogger>
        } as unknown as FastifyRequestTypebox<typeof checkAuthenticationSchema>,
        {
          send: mockSend,
          status: mockStatus
        } as unknown as FastifyReplyTypebox<typeof checkAuthenticationSchema>
      )

      expect(mockStatus).toHaveBeenCalledWith(401)
      expect(mockSend).toHaveBeenCalledWith(notAuthorized)
      expect(spyGetUserById).toHaveBeenCalledTimes(0)
      expect(spyGetUserByApiKey).toHaveBeenCalledTimes(0)
    })

    it('returns unauthorized when authorization bearer is a valid Sort JWT but is missing the user id', async () => {
      const mockSend = jest.fn()
      const mockStatus = jest.fn(() => ({ send: mockSend }) as any)
      const spyGetUserById = jest.spyOn(UserService, 'getUserById')
      const spyGetUserByApiKey = jest.spyOn(APIKeyService, 'getUserByAPIKey')

      // @ts-expect-error - forcing invalid Sort JWT
      const bearer = SortWebJwt.create({ invalid: true })

      await checkAuthentication()(
        {
          headers: {
            authorization: `bearer ${bearer}`
          },
          log: {
            info: jest.fn(),
            error: jest.fn()
          } as Partial<FastifyBaseLogger>
        } as unknown as FastifyRequestTypebox<typeof checkAuthenticationSchema>,
        {
          send: mockSend,
          status: mockStatus
        } as unknown as FastifyReplyTypebox<typeof checkAuthenticationSchema>
      )

      expect(mockStatus).toHaveBeenCalledWith(401)
      expect(mockSend).toHaveBeenCalledWith(notAuthorized)
      expect(spyGetUserById).toHaveBeenCalledTimes(0)
      expect(spyGetUserByApiKey).toHaveBeenCalledTimes(0)
    })

    it('returns unauthorized when Sort JWT user id does not exist', async () => {
      const mockSend = jest.fn()
      const mockStatus = jest.fn(() => ({ send: mockSend }) as any)
      const spyGetUserById = jest.spyOn(UserService, 'getUserById')
      const spyGetUserByApiKey = jest.spyOn(APIKeyService, 'getUserByAPIKey')

      const userId = 'h3ll0'
      const bearer = SortWebJwt.create({ user: { id: userId } })

      await checkAuthentication()(
        {
          headers: {
            authorization: `bearer ${bearer}`
          },
          log: {
            info: jest.fn(),
            error: jest.fn()
          } as Partial<FastifyBaseLogger>
        } as unknown as FastifyRequestTypebox<typeof checkAuthenticationSchema>,
        {
          send: mockSend,
          status: mockStatus
        } as unknown as FastifyReplyTypebox<typeof checkAuthenticationSchema>
      )

      expect(mockStatus).toHaveBeenCalledWith(401)
      expect(mockSend).toHaveBeenCalledWith(notAuthorized)
      expect(spyGetUserById).toHaveBeenCalledTimes(1)
      expect(spyGetUserById).toHaveBeenCalledWith(userId)
      expect(spyGetUserByApiKey).toHaveBeenCalledTimes(0)
    })

    it('returns unauthorized when Sort JWT was issued before the user reset their password', async () => {
      const mockSend = jest.fn()
      const mockStatus = jest.fn(() => ({ send: mockSend }) as any)

      const userId = 'h3ll0'
      const bearer = SortWebJwt.create({ user: { id: userId } })

      const spyGetUserById = jest
        .spyOn(UserService, 'getUserById')
        .mockResolvedValue(
          userMock.create({ password_reset_at: new Date(Date.now() + 1000) })
        )

      await checkAuthentication()(
        {
          headers: {
            authorization: `bearer ${bearer}`
          },
          log: {
            info: jest.fn(),
            error: jest.fn()
          } as Partial<FastifyBaseLogger>
        } as unknown as FastifyRequestTypebox<typeof checkAuthenticationSchema>,
        {
          send: mockSend,
          status: mockStatus
        } as unknown as FastifyReplyTypebox<typeof checkAuthenticationSchema>
      )

      expect(mockStatus).toHaveBeenCalledWith(401)
      expect(mockSend).toHaveBeenCalledWith(notAuthorized)
      expect(spyGetUserById).toHaveBeenCalledTimes(1)
      expect(spyGetUserById).toHaveBeenCalledWith(userId)
    })

    it('returns unauthorized when authorization bearer is a Email Confirmation JWT', async () => {
      const mockSend = jest.fn()
      const mockStatus = jest.fn(() => ({ send: mockSend }) as any)
      const spyGetUserById = jest.spyOn(UserService, 'getUserById')
      const spyGetUserByApiKey = jest.spyOn(APIKeyService, 'getUserByAPIKey')

      const bearer = EmailVerificationJwt.create({
        user: { id: 'h3ll0', email: 'test-user@sort.xyz' }
      })

      await checkAuthentication()(
        {
          headers: {
            authorization: `bearer ${bearer}`
          },
          log: {
            info: jest.fn(),
            error: jest.fn()
          } as Partial<FastifyBaseLogger>
        } as unknown as FastifyRequestTypebox<typeof checkAuthenticationSchema>,
        {
          send: mockSend,
          status: mockStatus
        } as unknown as FastifyReplyTypebox<typeof checkAuthenticationSchema>
      )

      expect(mockStatus).toHaveBeenCalledWith(401)
      expect(mockSend).toHaveBeenCalledWith(notAuthorized)
      expect(spyGetUserById).toHaveBeenCalledTimes(0)
      expect(spyGetUserByApiKey).toHaveBeenCalledTimes(0)
    })

    it('returns unauthorized when provided an invalid api key', async () => {
      const mockSend = jest.fn()
      const mockStatus = jest.fn(() => ({ send: mockSend }) as any)

      const mockGetUserByAPIKey = jest.fn(() => Promise.resolve(undefined))
      jest
        .spyOn(APIKeyService, 'getUserByAPIKey')
        .mockImplementation(mockGetUserByAPIKey)

      const apiKey = 'some-unknown.key'
      await checkAuthentication()(
        {
          headers: { 'x-api-key': apiKey },
          routerPath: '/',
          sort: {},
          method: 'GET',
          log: {
            info: jest.fn(),
            error: jest.fn()
          }
        } as unknown as FastifyRequestTypebox<typeof checkAuthenticationSchema>,
        {
          send: mockSend,
          status: mockStatus
        } as unknown as FastifyReplyTypebox<typeof checkAuthenticationSchema>
      )

      expect(mockSend).toHaveBeenCalledWith(notAuthorized)
      expect(mockStatus).toHaveBeenCalledWith(401)
      expect(mockGetUserByAPIKey).toHaveBeenCalledWith({ apiKey })
      expect(mockGetUserByAPIKey).toHaveBeenCalledTimes(1)
    })

    describe('restriction argument', () => {
      const testAuthenticationRule = ({
        description,
        label,
        email,
        restriction,
        callback
      }: {
        description: string
        label: string
        email: string
        restriction: authRestriction | undefined
        callback: (
          request: FastifyRequestTypebox<typeof checkAuthenticationSchema>,
          mockStatus: jest.Mock,
          mockSend: jest.Mock
        ) => void
      }) => {
        describe(description, () => {
          const user = userMock.create({ email })
          const apiKey = apiKeyMock.create({ user_id: user.id })
          const bearer = SortWebJwt.create({ user: { id: user.id } })

          describe.each([
            { 'x-api-key': apiKey.api_key },
            { authorization: `bearer ${bearer}` }
          ])('using headers %j', headers => {
            it(label, async () => {
              const mockGetUserById = jest.fn(() => Promise.resolve(user))
              jest
                .spyOn(UserService, 'getUserById')
                .mockImplementation(mockGetUserById)

              const mockGetUserByAPIKey = jest.fn(() => Promise.resolve(user))
              jest
                .spyOn(APIKeyService, 'getUserByAPIKey')
                .mockImplementation(mockGetUserByAPIKey)

              const request = {
                headers,
                sort: {},
                routerPath: '/',
                method: 'GET',
                log: {
                  info: jest.fn(),
                  error: jest.fn()
                } as Partial<FastifyBaseLogger>
              } as unknown as FastifyRequestTypebox<
                typeof checkAuthenticationSchema
              >

              const mockStatus = jest.fn(() => ({ send: mockSend }) as any)
              const mockSend = jest.fn()

              await checkAuthentication(restriction)(request, {
                send: mockSend,
                status: mockStatus
              } as unknown as FastifyReplyTypebox<
                typeof checkAuthenticationSchema
              >)

              callback(request, mockStatus, mockSend)
            })
          })
        })
      }

      describe('when not set', () => {
        testAuthenticationRule({
          restriction: undefined,
          description: 'when sortweb account is authenticating',
          label: 'defaults to isCustomerAccount and fails validation',
          email: SORTUI_SERVICE_ACCOUNT_EMAIL,
          callback: (request, mockStatus, mockSend) => {
            expect(mockSend).toBeCalledWith(notAuthorized)
            expect(mockStatus).toBeCalledWith(401)
          }
        })

        testAuthenticationRule({
          restriction: undefined,
          description: 'when customer account is authenticating',
          label: 'defaults to isCustomerAccount and passes validation',
          email: 'test-user@sort.xyz',
          callback: (request, mockStatus, mockSend) => {
            expect(request.sort.isCustomerAccount).toBe(true)
            expect(request.sort.isPublicAccount).toBe(false)
            expect(mockStatus).toBeCalledTimes(0)
            expect(mockSend).toBeCalledTimes(0)
          }
        })
      })

      describe('when set to isCustomerAccount', () => {
        testAuthenticationRule({
          restriction: 'isCustomerAccount',
          description: 'when sortweb account is authenticating',
          label: 'it fails validation',
          email: SORTUI_SERVICE_ACCOUNT_EMAIL,
          callback: (request, mockStatus, mockSend) => {
            expect(mockSend).toBeCalledWith(notAuthorized)
            expect(mockStatus).toBeCalledWith(401)
          }
        })

        testAuthenticationRule({
          restriction: 'isCustomerAccount',
          description: 'when customer account is authenticating',
          label: 'it passes validation',
          email: 'test-user@sort.xyz',
          callback: (request, mockStatus, mockSend) => {
            expect(request.sort.isCustomerAccount).toBe(true)
            expect(request.sort.isPublicAccount).toBe(false)
            expect(mockStatus).toBeCalledTimes(0)
            expect(mockSend).toBeCalledTimes(0)
          }
        })
      })

      describe('when set to isPublicAccount', () => {
        testAuthenticationRule({
          restriction: 'isPublicAccount',
          description: 'when sortweb account is authenticating',
          label: 'it passes validation',
          email: SORTUI_SERVICE_ACCOUNT_EMAIL,
          callback: (request, mockStatus, mockSend) => {
            expect(request.sort.isCustomerAccount).toBe(false)
            expect(request.sort.isPublicAccount).toBe(true)
            expect(mockStatus).toBeCalledTimes(0)
            expect(mockSend).toBeCalledTimes(0)
          }
        })

        testAuthenticationRule({
          restriction: 'isPublicAccount',
          description: 'when customer account is authenticating',
          label: 'it fails validation',
          email: 'test-user@sort.xyz',
          callback: (request, mockStatus, mockSend) => {
            expect(mockSend).toBeCalledWith(notAuthorized)
            expect(mockStatus).toBeCalledWith(401)
          }
        })
      })

      describe('when set to isAccount', () => {
        testAuthenticationRule({
          restriction: 'isAccount',
          description: 'when customer account is authenticating',
          label: 'it passes validation',
          email: 'test-user@sort.xyz',
          callback: (request, mockStatus, mockSend) => {
            expect(request.sort.isCustomerAccount).toBe(true)
            expect(request.sort.isPublicAccount).toBe(false)
            expect(mockStatus).toBeCalledTimes(0)
            expect(mockSend).toBeCalledTimes(0)
          }
        })

        testAuthenticationRule({
          restriction: 'isAccount',
          description: 'when sortweb account is authenticating',
          label: 'it passes validation',
          email: SORTUI_SERVICE_ACCOUNT_EMAIL,
          callback: (request, mockStatus, mockSend) => {
            expect(request.sort.isCustomerAccount).toBe(false)
            expect(request.sort.isPublicAccount).toBe(true)
            expect(mockStatus).toBeCalledTimes(0)
            expect(mockSend).toBeCalledTimes(0)
          }
        })
      })
    })
  })
})

describe('serverErrorHandler', () => {
  it('should respond with http 500 when an error occurs', async () => {
    const error = new Error('some error') as FastifyError
    error.code = 'WOMP'

    const mockLogError = jest.fn()
    const mockSend = jest.fn()
    const mockStatus = jest.fn(() => ({ send: mockSend }) as any)

    const mockRequest = {
      log: { error: mockLogError } as unknown,
      id: 'some-id'
    } as FastifyRequestTypebox<typeof serverErrorHandlerSchema>

    const mockReply = {
      send: mockSend,
      status: mockStatus
    } as unknown as FastifyReplyTypebox<typeof serverErrorHandlerSchema>

    await serverErrorHandler(error, mockRequest, mockReply)

    expect(mockLogError).toBeCalledTimes(1)
    expect(mockStatus).toBeCalledWith(500)
    expect(mockSend).toBeCalledWith({
      type: 'error',
      payload: {
        error: {
          message: expect.stringMatching(
            /Internal server error. If the problem persists/
          )
        }
      }
    })
  })

  describe('when error has statusCode property < 500', () => {
    it('sends the statusCode and message properties', async () => {
      const msg = 'rate limit exceeded'
      const statusCode = 429

      const error = new Error(msg) as FastifyError
      error.statusCode = statusCode

      const mockLog = jest.fn()
      const mockSend = jest.fn()
      const mockStatus = jest.fn(() => ({ send: mockSend }) as any)

      const mockRequest = {
        log: { info: mockLog } as unknown,
        id: 'some-id'
      } as FastifyRequestTypebox<typeof serverErrorHandlerSchema>

      const mockReply = {
        send: mockSend,
        status: mockStatus
      } as unknown as FastifyReplyTypebox<typeof serverErrorHandlerSchema>

      await serverErrorHandler(error, mockRequest, mockReply)

      expect(mockLog).toBeCalledTimes(1)
      expect(mockStatus).toBeCalledWith(statusCode)
      expect(mockSend).toBeCalledWith({
        type: 'error',
        payload: {
          error: {
            message: msg
          }
        }
      })
    })

    it('sends 404 not found if err is NotFoundError', async () => {
      const mockSend = jest.fn()
      const mockStatus = jest.fn(() => ({ send: mockSend }) as any)
      const mockSendNotFound = jest.fn()

      const url = '/v2/orgs/any'
      const method = 'GET'

      const mockRequest = {
        log: createFastifyMockLogger(),
        raw: { url, method },
        id: 'some-id'
      } as FastifyRequestTypebox<typeof serverErrorHandlerSchema>

      const mockReply = {
        send: mockSend,
        sendNotFound: mockSendNotFound,
        status: mockStatus
      } as unknown as FastifyReplyTypebox<typeof serverErrorHandlerSchema>

      const error = new NotFoundError('change request')

      await serverErrorHandler(error, mockRequest, mockReply)

      expect(mockSendNotFound).toHaveBeenCalledWith('change request')
    })
  })

  describe('when invalid JSON syntax is submitted', () => {
    it('responds with HTTP 400 and details about the error', async () => {
      const msg =
        "Expected ',' or '}' after property value in JSON at position 136"
      const statusCode = 400

      const error = new SyntaxError(msg) as FastifyError
      error.statusCode = statusCode

      const mockLog = jest.fn()
      const mockSend = jest.fn()
      const mockStatus = jest.fn(() => ({ send: mockSend }) as any)

      const mockRequest = {
        log: { info: mockLog } as unknown,
        id: 'some-id'
      } as FastifyRequestTypebox<typeof serverErrorHandlerSchema>

      const mockReply = {
        send: mockSend,
        status: mockStatus
      } as unknown as FastifyReplyTypebox<typeof serverErrorHandlerSchema>

      await serverErrorHandler(error, mockRequest, mockReply)

      expect(mockLog).toBeCalledTimes(1)
      expect(mockStatus).toBeCalledWith(statusCode)
      expect(mockSend).toBeCalledWith({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'A validation error occurred when parsing the JSON body.',
            context: 'body',
            errors: {
              body: {
                syntax: msg
              }
            }
          }
        }
      })
    })
  })

  describe('when no JSON is submitted but "content-type" header is "application/json"', () => {
    it('responds with HTTP 400 and details about the error', async () => {
      const message =
        'Body cannot be empty when content-type is set to application/json.'
      const statusCode = 400
      const error = new Error(message) as FastifyError
      error.name = 'FastifyError'
      error.statusCode = statusCode
      error.code = 'FST_ERR_CTP_EMPTY_JSON_BODY'

      const mockLog = createFastifyMockLogger()
      const mockSend = jest.fn()
      const mockStatus = jest.fn(() => ({ send: mockSend }) as any)

      const mockRequest = {
        log: mockLog,
        id: 'some-id'
      } as FastifyRequestTypebox<typeof serverErrorHandlerSchema>

      const mockReply = {
        send: mockSend,
        status: mockStatus
      } as unknown as FastifyReplyTypebox<typeof serverErrorHandlerSchema>

      await serverErrorHandler(error, mockRequest, mockReply)

      expect(mockStatus).toHaveBeenCalledWith(statusCode)
      expect(mockSend).toHaveBeenCalledWith({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'A validation error occurred.',
            context: 'body',
            errors: {
              body: {
                message
              }
            }
          }
        }
      })
    })
  })

  describe.each(['headers', 'body', 'querystring', 'params'])(
    'when a %s validation error occurs',
    type => {
      it('should respond with http 400', async () => {
        type inputTypes = 'headers' | 'body' | 'querystring' | 'params'

        const error = new Error('some error') as FastifyError
        error.code = 'WOMP'
        error.validationContext = type as inputTypes
        error.validation = [
          {
            keyword: 'required',
            message: 'x is missing',
            params: { missingProperty: 'x' },
            instancePath: '/x',
            schemaPath: '#/required'
          }
        ]

        const mockSend = jest.fn()
        const mockStatus = jest.fn(() => ({ send: mockSend }) as any)

        const mockRequest = {
          id: 'some-id',
          log: createFastifyMockLogger()
        } as FastifyRequestTypebox<typeof serverErrorHandlerSchema>

        const mockReply = {
          send: mockSend,
          status: mockStatus
        } as unknown as FastifyReplyTypebox<typeof serverErrorHandlerSchema>

        await serverErrorHandler(error, mockRequest, mockReply)

        expect(mockStatus).toHaveBeenCalledWith(400)
        expect(mockSend).toHaveBeenCalledWith({
          type: 'validation_error',
          payload: {
            validation_error: {
              context: type,
              errors: {
                [type === 'querystring' ? 'query' : type]: {
                  x: 'is required'
                }
              },
              message: `A validation error occurred when validating the ${type}.`
            }
          }
        })
      })
    }
  )
})

describe('notFoundHandler', () => {
  it('should respond with http 404', async () => {
    const mockLogInfo = jest.fn()
    const mockSend = jest.fn()
    const mockStatus = jest.fn(() => ({ send: mockSend }) as any)

    const url = `/v2/orgs/${'x'.repeat(101)}`
    const method = 'GET'

    const mockRequest = {
      log: { info: mockLogInfo } as unknown,
      raw: { url, method },
      id: 'some-id'
    } as FastifyRequestTypebox<typeof notFoundHandlerSchema>

    const mockReply = {
      send: mockSend,
      status: mockStatus
    } as unknown as FastifyReplyTypebox<typeof notFoundHandlerSchema>

    notFoundHandler(mockRequest, mockReply)

    expect(mockLogInfo).toBeCalledTimes(1)
    expect(mockStatus).toBeCalledWith(404)
    expect(mockSend).toBeCalledWith({
      type: 'error',
      payload: {
        error: {
          message: `Route ${method}:${url} not found.`
        }
      }
    })
  })
})
