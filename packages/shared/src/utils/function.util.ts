type shouldRetryType = (error: Error) => boolean

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const retry = async <T extends (attempt: number) => any>(
  fn: T,
  shouldRetry: shouldRetryType,
  retriesLeft = 3
): Promise<ReturnType<T> | undefined> => {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return await fn(retriesLeft)
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error
      }

      retriesLeft -= 1

      const result = shouldRetry(error)
      if (result === false) {
        return undefined
      }

      if (retriesLeft === 0) {
        throw error
      }
    }
  }
}

export const sleep = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms))
