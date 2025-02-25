import { PublicFacingError } from '../public-facing.error'

import type { Change } from '../../schemas/change.schema'

export class ZeroAffectedRowsError extends PublicFacingError {
  code = 'ZERO_AFFECTED_ROWS_ERROR'

  cause: {
    query: string
    parameters: ReadonlyArray<unknown>
    change: Change
  }

  constructor(
    query: string,
    parameters: ReadonlyArray<unknown>,
    change: Change
  ) {
    super(
      `Zero rows affected by change ${change.id} in ${change.change_request_id}`
    )
    this.cause = { query, parameters, change }
  }
}
