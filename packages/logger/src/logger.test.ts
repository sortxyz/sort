import process from 'process'

import * as Sentry from '@sentry/node'

import { createLogger, notifySentry } from './'

describe('createLogger', () => {
  it('creates a logger', () => {
    const logger = createLogger({
      LOG_LEVEL: 'info',
      APP_VERSION: 'something'
    })

    // @ts-expect-error - level is not part of our public API
    expect(logger.level).toBe('info')
    // @ts-expect-error - bindings is not part of our public API
    expect(logger.bindings()).toEqual({
      processId: process.pid,
      version: 'something'
    })
  })

  it('supports setting bindings on child loggers', () => {
    const logger = createLogger({
      LOG_LEVEL: 'info',
      APP_VERSION: 'something'
    }).child({ jobId: 'some-job-123' })

    expect(logger.level).toBe('info')
    expect(logger.bindings()).toEqual({
      processId: process.pid,
      version: 'something',
      jobId: 'some-job-123'
    })
  })
})

describe('notifySentry', () => {
  it('forwards the error to the Sentry SDK', () => {
    const sentrySpy = jest.fn()
    jest.spyOn(Sentry, 'captureException').mockImplementation(sentrySpy)

    const error = new Error('test')
    const message = 'test message'
    const contextId = 'hi'
    notifySentry({
      error,
      message,
      contextId
    })

    expect(sentrySpy).toHaveBeenCalledWith(error, {
      extra: { message },
      tags: { contextId, processId: process.pid }
    })
  })
})
