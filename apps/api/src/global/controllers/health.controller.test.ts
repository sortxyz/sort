const mockDb = jest.fn()

import * as crypto from 'node:crypto'

import { createFastifyMockLogger } from '../../v2/mocks/fastify-logger.mock'
import { toServerErrorMessage } from '../utils/error.util'

import * as HealthController from './health.controller'

import type { FastifyBaseLogger, FastifyRequest } from 'fastify'

jest.mock('../services/kysely.service', () => ({
  getDb: () => ({
    selectFrom: () => ({
      selectAll: () => ({
        limit: () => ({
          execute: mockDb
        })
      })
    })
  })
}))

describe('Tests for HealthController', () => {
  describe('check', () => {
    it('Should return a success response when all dependencies are working', async () => {
      const sendMock = jest.fn()
      // eslint-disable-next-line
      const statusMock = jest.fn(() => ({ send: sendMock } as any))
      const log = createFastifyMockLogger()

      await HealthController.check(
        {
          id: crypto.randomUUID(),
          log
        } as FastifyRequest,
        {
          send: sendMock,
          status: statusMock
        }
      )

      expect(log.info).toHaveBeenCalledTimes(1)
      expect(log.info).toHaveBeenCalledWith('Checking dependency health..')
      expect(statusMock).toHaveBeenCalledTimes(1)
      expect(statusMock).toHaveBeenCalledWith(204)

      expect(sendMock).toHaveBeenCalledTimes(1)
    })

    it('Should return a error response when failing to connect into db database', async () => {
      const mockId = crypto.randomUUID()
      const sendMock = jest.fn()
      // eslint-disable-next-line
      const statusMock = jest.fn(() => ({ send: sendMock } as any))
      const mockError = jest.fn()

      mockDb.mockImplementationOnce(() =>
        Promise.reject(new Error('ECONNRESET'))
      )

      await HealthController.check(
        {
          id: mockId,
          log: {
            error: mockError,
            info: jest.fn()
          } as Partial<FastifyBaseLogger>
        } as FastifyRequest,
        {
          send: sendMock,
          status: statusMock
        }
      )

      expect(mockError).toHaveBeenCalledTimes(1)
      const error = mockError.mock.calls[0][0]
      expect(error.message).toMatch(
        /^Error checking base db connection: ECONNRESET/
      )

      expect(statusMock).toHaveBeenCalledTimes(1)
      expect(statusMock).toHaveBeenCalledWith(503)

      expect(sendMock).toHaveBeenCalledTimes(1)
      expect(sendMock).toHaveBeenCalledWith({
        code: 503,
        message: toServerErrorMessage(
          mockId,
          "API dependencies aren't working properly."
        )
      })
    })
  })
})
