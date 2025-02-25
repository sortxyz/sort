export class QueryTimeoutError extends Error {
  code = 'QUERY_TIMEOUT_ERROR'

  constructor(msg: string, options?: ErrorOptions) {
    super(msg, options)
  }
}
