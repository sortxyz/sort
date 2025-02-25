import { PublicFacingError } from '../public-facing.error'

import type { Change } from '../../schemas/change.schema'

export class ExecutionFailureError extends PublicFacingError {
  code = 'EXECUTION_FAILURE'

  cause: {
    query: string
    change: Change
    parameters: ReadonlyArray<unknown>
  }

  constructor(
    msg: string,
    query: string,
    parameters: ReadonlyArray<unknown>,
    change: Change,
    options?: ErrorOptions
  ) {
    super(msg, options)

    this.cause = { query, parameters, change }
  }
}
