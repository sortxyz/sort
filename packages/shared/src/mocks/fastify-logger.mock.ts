import type { FastifyBaseLogger } from 'fastify'

export const createFastifyMockLogger = () => {
  return {
    info: jest.fn(),
    error: jest.fn()
  } as unknown as FastifyBaseLogger
}
