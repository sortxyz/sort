import type {
  RequestChange,
  RequestChangeFieldValue
} from '../../schemas/change.schema'
import type { ChangeSelect } from '../../types/change-request.types'

export class NonNullableColumnError extends Error {
  code = 'NON_NULLABLE_COLUMN_ERROR'
  cause: {
    change: RequestChange
    field: RequestChangeFieldValue
    payloadIndex?: number
  }

  constructor(
    name: string,
    options: {
      cause: {
        change: RequestChange
        field: RequestChangeFieldValue
        payloadIndex?: number
      }
    }
  ) {
    super(`Column "${name}" cannot be null.`)
    this.cause = options.cause
  }
}

export class NonNullableNonGeneratedFieldError extends Error {
  code = 'NON_NULLABLE_NON_GENERATED_FIELD_ERROR'
  cause: {
    change: ChangeSelect
    field?: RequestChangeFieldValue
    payloadIndex?: number
  }

  constructor(
    name: string,
    options: {
      cause: {
        change: ChangeSelect
        field?: RequestChangeFieldValue
        payloadIndex?: number
      }
    }
  ) {
    super(
      `Field "${name}" cannot be null because its column is not nullable and not generated.`
    )
    this.cause = options.cause
  }
}
