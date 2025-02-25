export class SqlSyntaxError extends Error {
  code = 'SQL_SYNTAX_ERROR'

  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
  }
}
