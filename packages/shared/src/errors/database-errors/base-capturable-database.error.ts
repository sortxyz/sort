export class BaseCapturableDatabaseError extends Error {
  public helpfulProviderMessage?: string

  constructor(message: unknown, options?: ErrorOptions) {
    const msg =
      typeof message === 'string'
        ? message
        : message instanceof Error
          ? message.message
          : ((options?.cause as Error)?.message ?? 'Unknown error.')

    super(msg, options)
  }
}
