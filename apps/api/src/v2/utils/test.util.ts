import { randomUUID } from 'node:crypto'

import * as APIKeyService from '@sort/shared/services/apikey.service'

import * as KyselyService from '../../global/services/kysely.service'
import { getTestServer } from '../../global/utils/test.util'
import { auth0JwtMock, sortJwtMock } from '../mocks/jwt.mock'

import { createSortJwt } from './jwt.util'

import type { NotFoundEntity } from '@sort/shared/errors/not-found.error'
import type { InjectOptions, LightMyRequestResponse } from 'fastify'

/**
 * Creates a test headers object for the given header name and userId.
 * Supported header names: 'authorization' and 'x-api-key'.
 **/
export const getAuthHeaders = async (name: string, userId: string) => {
  let value = ''

  if (name === 'authorization') {
    value = `Bearer ${createSortJwt(userId)}`
  } else {
    const result = await APIKeyService.createAPIKey({
      summary: 'Test API Key',
      userId: userId
    })
    value = result.api_key
  }

  return {
    [name]: value
  }
}

/**
 * Confirms Sort authorization is required (either authorization bearer with
 * SortJWT or x-api-key) for the given server and request options.
 */
export const testInvalidSortAuthHeaders = (requestOptions: InjectOptions) => {
  it('should respond with 401 when no auth headers are sent', async () => {
    if (!requestOptions.headers) requestOptions.headers = {}
    delete requestOptions.headers.authorization
    delete requestOptions.headers['x-api-key']

    const server = await getTestServer()
    const response = await server.inject(requestOptions)

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

  it('should respond with 401 when an invalid authorization header is sent', async () => {
    if (!requestOptions.headers) requestOptions.headers = {}
    delete requestOptions.headers['x-api-key']
    requestOptions.headers.authorization = 'invalid'

    const server = await getTestServer()
    const response = await server.inject(requestOptions)

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

  it('should respond with 401 when authorization bearer token is an invalid Sort JWT', async () => {
    if (!requestOptions.headers) requestOptions.headers = {}
    delete requestOptions.headers['x-api-key']
    requestOptions.headers.authorization = auth0JwtMock

    const server = await getTestServer()
    const response = await server.inject(requestOptions)
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

  it('should respond with 401 when an invalid api key is sent', async () => {
    if (!requestOptions.headers) requestOptions.headers = {}
    delete requestOptions.headers.authorization
    requestOptions.headers['x-api-key'] = randomUUID()

    const server = await getTestServer()
    const response = await server.inject(requestOptions)

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
}

/**
 * Confirms the authentication header is a valid Auth0 JWT for the given
 * server and route options.
 */
export const testInvalidAuth0AuthHeaders = (requestOptions: InjectOptions) => {
  const fourOhFour = {
    type: 'error',
    payload: {
      error: {
        message: expect.stringMatching(/^Route [A-Z]+:.+ not found$/)
      }
    }
  }

  const expect404 = async () => {
    const server = await getTestServer()
    const response = await server.inject(requestOptions)
    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual(fourOhFour)
  }

  it('responds with 404 when no auth headers are sent', async () => {
    if (!requestOptions.headers) requestOptions.headers = {}
    delete requestOptions.headers['x-api-key']
    delete requestOptions.headers.authorization

    await expect404()
  })

  it('responds with 404 when an invalid authorization value is sent', async () => {
    if (!requestOptions.headers) requestOptions.headers = {}
    delete requestOptions.headers['x-api-key']
    delete requestOptions.headers.authorization

    requestOptions.headers.authorization = 'bearer-invalid'
    await expect404()
  })

  it('responds with 404 when authorization bearer token is an invalid Auth0 JWT', async () => {
    if (!requestOptions.headers) requestOptions.headers = {}
    delete requestOptions.headers['x-api-key']
    delete requestOptions.headers.authorization

    requestOptions.headers.authorization = sortJwtMock
    await expect404()
  })
}

export const getDbSlug = async ({
  connectionId,
  databaseRawName
}: {
  connectionId: string
  databaseRawName: string
}) => {
  const row = await KyselyService.getDb()
    .selectFrom('connection')
    .innerJoin(
      'metadata_database',
      'connection.id',
      'metadata_database.connection_id'
    )
    .where('connection.id', '=', connectionId)
    .where('metadata_database.raw_name', '=', databaseRawName)
    .select('metadata_database.slug')
    .executeTakeFirstOrThrow()

  return row.slug
}

export const expectNotFound = (
  response: LightMyRequestResponse,
  entity: NotFoundEntity
) => {
  const thing = entity.charAt(0).toUpperCase() + entity.slice(1)

  expect(response.json()).toEqual({
    type: 'error',
    payload: {
      error: {
        message: `${thing} not found.`
      }
    }
  })

  expect(response.statusCode).toBe(404)
}

type HTTPMethods = 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT'

interface ParamTestConfig {
  expectedNotFoundEntity: NotFoundEntity
  expectedValidationError: string
  validValue: string
  invalidValue: string
  notFoundValue: string
}

export type ParamTestConfigurations = {
  [key: string]: ParamTestConfig
}

export class ParamsTester {
  constructor(public config: ParamTestConfigurations) {}

  generateTestUrl(
    type: 'invalid' | 'notFound',
    baseUrl: string,
    paramName: string
  ) {
    return (baseUrl.match(/:\w+/g) || []).reduce((url, param) => {
      const name = param.slice(1) // Remove the colon
      const paramConfig = this.config[name]
      if (!paramConfig) {
        const keys = JSON.stringify(Object.keys(this.config))
        throw new Error(`Unknown param name: ${name}. Valid keys: ${keys}`)
      }

      const value =
        type === 'invalid'
          ? name === paramName
            ? paramConfig.invalidValue
            : paramConfig.validValue
          : name === paramName
            ? paramConfig.notFoundValue
            : paramConfig.validValue
      return url.replace(param, value)
    }, baseUrl)
  }

  testInvalidParams({
    method,
    userId,
    url,
    payload
  }: {
    method: HTTPMethods
    userId: string
    url: string
    payload?: Record<string, unknown>
  }) {
    const baseHeaders = {
      authorization: `Bearer ${createSortJwt(userId)}`
    }

    const paramNames = (url.match(/:\w+/g) || []).map(param => param.slice(1))

    for (const paramName of paramNames) {
      const { invalidValue, expectedValidationError } =
        this.config[paramName] || {}

      if (invalidValue && expectedValidationError) {
        it(`should respond with 400 when the ${paramName} is invalid`, async () => {
          const testUrl = this.generateTestUrl('invalid', url, paramName)

          const server = await getTestServer()

          const response = await server.inject({
            headers: baseHeaders,
            method,
            url: testUrl,
            payload
          })

          expect(response.json()).toEqual({
            type: 'validation_error',
            payload: {
              validation_error: {
                context: 'params',
                errors: {
                  params: {
                    [paramName]: expectedValidationError
                  }
                },
                message:
                  'A validation error occurred when validating the params.'
              }
            }
          })

          expect(response.statusCode).toBe(400)
        })
      }
    }
  }

  testNotFound({
    method,
    url,
    userId,
    defaultPayload
  }: {
    method: HTTPMethods
    url: string
    userId: string
    defaultPayload?: object
  }) {
    const baseHeaders = {
      authorization: `Bearer ${createSortJwt(userId)}`
    }

    const paramNames = (url.match(/:\w+/g) || []).map(param => param.slice(1))

    paramNames.forEach(paramName => {
      const { expectedNotFoundEntity } = this.config[paramName]

      if (expectedNotFoundEntity) {
        it(`should respond with 404 when the ${paramName} does not exist`, async () => {
          const testUrl = this.generateTestUrl('notFound', url, paramName)

          const requestOptions: InjectOptions = {
            headers: baseHeaders,
            method,
            url: testUrl
          }

          if (
            ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method) &&
            defaultPayload
          ) {
            requestOptions.payload = defaultPayload
          }

          const server = await getTestServer()
          const response = await server.inject(requestOptions)
          expectNotFound(response, expectedNotFoundEntity)
        })
      }
    })
  }
}
