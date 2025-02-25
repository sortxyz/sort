import { shutdownGracefully } from './shutdown'

describe('shutdownGracefully', () => {
  it('should log and kill process', async () => {
    const mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    }

    const mockCleanup = jest.fn()

    const mockProcessKill = jest
      .spyOn(process, 'kill')
      .mockImplementation(() => true)

    await shutdownGracefully({
      source: 'test',
      signal: 'SIGTERM',
      logger: mockLogger,
      cleanup: mockCleanup
    })

    expect(mockLogger.info).toHaveBeenNthCalledWith(
      1,
      "Shutting down gracefully from 'test'"
    )
    expect(mockLogger.error).not.toHaveBeenCalled()
    expect(mockCleanup).toHaveBeenCalled()
    expect(mockLogger.info).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(
        `Killing process (self) PID: ${process.pid} with signal 'SIGTERM'..`
      )
    )
    expect(mockProcessKill).toHaveBeenCalledWith(process.pid, 'SIGTERM')
  })
})
