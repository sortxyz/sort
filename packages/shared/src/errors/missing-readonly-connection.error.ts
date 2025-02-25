export class MissingReadonlyConnectionError extends Error {
  code = 'MISSING_READONLY_CONNECTION'

  constructor(name: string, options?: ErrorOptions) {
    const msg = `No read-only connection found for connection "${name}". Please add a read-only connection.`
    super(msg, options)
  }
}
