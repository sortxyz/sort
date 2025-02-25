import { isErrnoException } from './server.util'

describe('isErrnoException', () => {
  it('should return true if the error is an ErrnoException', () => {
    // Arrange

    const error: NodeJS.ErrnoException = new Error('message')
    error.errno = 1
    error.code = 'code'
    error.path = 'path'
    error.syscall = 'syscall'

    // Act
    const result = isErrnoException(error)

    // Assert
    expect(result).toBe(true)
  })
})
