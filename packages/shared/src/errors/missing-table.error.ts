export class MissingTableError extends Error {
  code = 'MISSING_TABLE_ERROR'

  constructor(name: string, options?: ErrorOptions) {
    super(`Table ${name} does not exist`, options)
  }
}
