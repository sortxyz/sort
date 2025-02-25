/** A change request execution job already exists and is in progress. */
export class JobExistsError extends Error {
  constructor(changeRequestId: string) {
    super(
      `A job for change request id "${changeRequestId}" is already in progress.`
    )
  }
}
