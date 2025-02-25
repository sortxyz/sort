export class DatabaseConnectionTimeoutError extends Error {
  code = 'DATABASE_CONNECTION_TIMEOUT_ERROR'

  constructor(msg: string, options?: ErrorOptions) {
    super(msg, options)
  }
}
