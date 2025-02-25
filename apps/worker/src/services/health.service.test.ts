const getMock = jest.fn()
const listenMock = jest.fn()

import { config } from '../config/bootstrap'

import * as HealthService from './health.service'

import type { RouteHandlerMethod } from 'fastify'

const addressMock = jest.fn()
const setErrorHandlerMock = jest.fn()

const { HEALTH_SERVICE_HOST, HEALTH_SERVICE_PORT } = config

jest.mock('fastify', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    get: getMock,
    listen: listenMock,
    setErrorHandler: setErrorHandlerMock,
    server: { address: addressMock }
  }))
}))

describe('Tests for HealthService', () => {
  const successHealthCheckMsg = ''

  beforeEach(async () => {
    jest.clearAllMocks()
  })

  describe('healthService', () => {
    it('Should start a health check in the root endpoint when starting fastify server', async () => {
      await HealthService.healthService(() => Promise.resolve(''))

      expect(getMock).toHaveBeenCalledTimes(1)
      expect(getMock).toHaveBeenCalledWith('/', expect.anything())

      expect(listenMock).toHaveBeenCalledTimes(1)
      expect(listenMock).toHaveBeenCalledWith({
        host: HEALTH_SERVICE_HOST,
        port: HEALTH_SERVICE_PORT
      })

      expect(addressMock).toHaveBeenCalledTimes(1)
      expect(setErrorHandlerMock).toHaveBeenCalledTimes(1)
    })

    it('Should call health check on a successful health service check', async () => {
      const healthSvcFn = jest.fn().mockResolvedValue(successHealthCheckMsg)
      // eslint-disable-next-line
      const healthEndpoint = await HealthService.healthServiceEndpoint(
        healthSvcFn
      )

      const checkDbSpy = jest
        .spyOn(HealthService, 'checkDatabase')
        // eslint-disable-next-line
        .mockResolvedValue(null as any)

      const sendMock = jest.fn()
      // eslint-disable-next-line
      const req = { log: { error: jest.fn() } } as jest.Mocked<any>
      const reply = {
        status: jest.fn().mockImplementation(() => ({
          send: sendMock
        }))
        // eslint-disable-next-line
      } as jest.Mocked<any>

      // @ts-expect-error req, reply mocking
      // eslint-disable-next-line
      await healthEndpoint(req, reply)

      expect(healthSvcFn).toHaveBeenCalledTimes(1)
      expect(checkDbSpy).toHaveBeenCalledTimes(1)
      expect(reply.status).toHaveBeenCalledTimes(1)
      expect(reply.status).toHaveBeenCalledWith(204)
      expect(sendMock).toHaveBeenCalledTimes(1)
      expect(sendMock).toHaveBeenCalledWith()
    })

    it('Should fail health check on a failed health service check', async () => {
      const healthSvcFn = jest
        .fn()
        .mockResolvedValue('Failed health check message')

      // eslint-disable-next-line
      const healthEndpoint = await HealthService.healthServiceEndpoint(
        healthSvcFn
      )

      const checkDbSpy = jest
        .spyOn(HealthService, 'checkDatabase')
        // eslint-disable-next-line
        .mockResolvedValue(null as any)

      const sendMock = jest.fn()
      const req = { log: { error: jest.fn() } }
      const reply = {
        status: jest.fn().mockImplementation(() => ({
          send: sendMock
        }))
        // eslint-disable-next-line
      } as jest.Mocked<any>

      // @ts-expect-error healthEndpoint(fastify) has no valid this in tests
      await healthEndpoint(req, reply)

      expect(healthSvcFn).toHaveBeenCalledTimes(1)
      expect(checkDbSpy).toHaveBeenCalledTimes(0)
      expect(reply.status).toHaveBeenCalledTimes(1)
      expect(reply.status).toHaveBeenCalledWith(503)
      expect(sendMock).toHaveBeenCalledTimes(1)
      expect(sendMock).toHaveBeenCalledWith({
        code: 503,
        message: 'Failed health check message'
      })
    })
  })

  describe('healthServiceEndpoint', () => {
    it('Should return a function for use as a fastify handler', async () => {
      const healthSvcFn = jest.fn().mockResolvedValue(successHealthCheckMsg)
      const endpoint = HealthService.healthServiceEndpoint(healthSvcFn)

      expect(endpoint).toBeInstanceOf(Function)
      expect(endpoint).toHaveLength(2)
      expect(endpoint.name).toBe('healthServiceRequestHandler')
    })
  })

  describe('healthServiceRequestHandler', () => {
    let healthSvcFn: jest.Mock
    // eslint-disable-next-line
    let dbCheckMock: jest.SpyInstance<any, any, any>
    // eslint-disable-next-line
    let errorLogMock: jest.Mock<any, any, any>
    // eslint-disable-next-line
    let sendMock: jest.Mock<any, any, any>
    // eslint-disable-next-line
    let statusMock: jest.Mock<any, any, any>
    // eslint-disable-next-line
    let req: any, reply: any
    let healthEndpoint: RouteHandlerMethod

    beforeEach(async () => {
      healthSvcFn = jest.fn().mockResolvedValue(successHealthCheckMsg)

      // eslint-disable-next-line
      healthEndpoint = await HealthService.healthServiceEndpoint(healthSvcFn)

      dbCheckMock = jest
        .spyOn(HealthService, 'checkDatabase')
        .mockResolvedValue({
          rows: [
            {
              pid: 1234
            }
          ]
        })

      sendMock = jest.fn()
      statusMock = jest.fn().mockImplementation(() => ({
        send: sendMock
      }))
      errorLogMock = jest.fn()
      req = { log: { error: errorLogMock }, id: 50 }
      reply = {
        status: statusMock
      }
    })

    it('Should check the inner health service function', async () => {
      // @ts-expect-error healthEndpoint(fastify) has no valid this in tests
      await healthEndpoint(req, reply)

      expect(healthSvcFn).toHaveBeenCalledTimes(1)
      expect(healthSvcFn).toHaveBeenCalledWith()
    })

    it('Should check the database', async () => {
      // @ts-expect-error healthEndpoint(fastify) has no valid this in tests
      await healthEndpoint(req, reply)

      expect(dbCheckMock).toHaveBeenCalledTimes(1)
    })

    it('Should send a reply with successful status', async () => {
      // @ts-expect-error healthEndpoint(fastify) has no valid this in tests
      await healthEndpoint(req, reply)

      expect(sendMock).toHaveBeenCalledTimes(1)
      expect(sendMock).toHaveBeenCalledWith()
      expect(statusMock).toHaveBeenCalledWith(204)
    })

    it('Should log an error on failure', async () => {
      healthSvcFn = jest.fn(() => {
        throw new Error('some failure')
      })

      // eslint-disable-next-line
      healthEndpoint = await HealthService.healthServiceEndpoint(healthSvcFn)

      // @ts-expect-error healthEndpoint(fastify) has no valid this in tests
      await healthEndpoint(req, reply)

      expect(errorLogMock).toHaveBeenCalledTimes(1)
      expect(errorLogMock).toHaveBeenCalledWith(new Error('some failure'))
    })

    it('Should reply on failure', async () => {
      healthSvcFn = jest.fn(() => {
        throw new Error('some failure')
      })

      // eslint-disable-next-line
      healthEndpoint = await HealthService.healthServiceEndpoint(healthSvcFn)

      // @ts-expect-error healthEndpoint(fastify) has no valid this in tests
      await healthEndpoint(req, reply)

      expect(sendMock).toHaveBeenCalledTimes(1)
      expect(sendMock).toHaveBeenCalledWith({
        code: 503,
        message: "API dependencies aren't working properly. Request id: 50"
      })
      expect(statusMock).toHaveBeenCalledWith(503)
    })
  })
})
