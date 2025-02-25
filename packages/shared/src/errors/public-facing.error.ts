export class PublicFacingError extends Error {
  code: string

  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.code = 'PUBLIC_FACING_ERROR'
  }
}
