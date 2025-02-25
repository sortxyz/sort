// Simplify the mock setup to directly mock the chainable methods.
const mockFastifyInstance = {
  delete: jest.fn(),
  get: jest.fn(),
  post: jest.fn(),
  register: jest.fn(),
  ready: jest.fn(),
  decorateRequest: jest.fn(),
  decorateReply: jest.fn(),
  patch: jest.fn(),
  route: jest.fn(),
  addHook: jest.fn(),
  // Ensure withTypeProvider returns the mock instance itself to allow chaining.
  withTypeProvider: jest.fn()
}

// Setup all chainable methods to return the mock instance for chaining.
Object.values(mockFastifyInstance).forEach(mockFn => {
  if (jest.isMockFunction(mockFn)) {
    mockFn.mockReturnValue(mockFastifyInstance)
  }
})

// Mock the Fastify import to use the mock instance.
// The default export should be a function that returns the mock instance.
jest.mock('fastify', () => ({
  __esModule: true,
  default: jest.fn(() => mockFastifyInstance)
}))

import { createServer, onSendHook } from './server.util'

import type { FastifyReply, FastifyRequest } from 'fastify'

describe('global server utils', () => {
  describe('createServer', () => {
    it('Should create a new server with swagger, logger, type provider and routes', async () => {
      await createServer()

      expect(mockFastifyInstance.register).toHaveBeenCalledTimes(4)
      expect(mockFastifyInstance.decorateRequest).toHaveBeenCalledTimes(1)
      expect(mockFastifyInstance.addHook).toHaveBeenCalledTimes(2)
      expect(mockFastifyInstance.ready).toHaveBeenCalledTimes(1)
    })
  })

  describe('onSendHook', () => {
    it('adds request.id to the request-id response header', async () => {
      const headerMock = jest.fn()
      const reply = { header: headerMock } as unknown as FastifyReply
      const req = { id: 'test-id' } as FastifyRequest
      await onSendHook(req, reply)
      expect(headerMock).toHaveBeenCalledWith('request-id', 'test-id')
    })
  })
})
