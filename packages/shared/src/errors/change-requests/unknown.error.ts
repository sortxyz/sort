import type {
  ChangePrimaryKey,
  RequestChange,
  RequestChangeFieldValue
} from '../../schemas/change.schema'
import type { QueryColumn } from '../../schemas/query-execution.schema'
import type {
  ChangeFieldValueSelect,
  ChangePrimaryKeySelect,
  ChangeSelect
} from '../../types/change-request.types'

export class UnknownValueError extends Error {
  cause: {
    value: ChangeFieldValueSelect | ChangePrimaryKeySelect
    change: ChangeSelect
  }

  constructor(
    value: ChangeFieldValueSelect | ChangePrimaryKeySelect,
    change: ChangeSelect
  ) {
    super(`Unknown value for column: ${value.column_name}`)

    this.cause = {
      value,
      change
    }
  }
}

export class UnknownColumnTypeError extends Error {
  cause: {
    columnName: string
    type: string
  }

  constructor({ columnName, type }: { columnName: string; type: string }) {
    super(`Unknown column type for: "${columnName}". Requested type: "${type}"`)

    this.cause = {
      columnName,
      type
    }
  }
}

export class InvalidColumnTypeError extends Error {
  cause: {
    entity: RequestChangeFieldValue
  }

  constructor(entity: RequestChangeFieldValue, type: string) {
    super(
      `Invalid column type for: ${entity.column_name}. It is not of type: ${type}`
    )

    this.cause = {
      entity
    }
  }
}

export class InvalidValueError extends Error {
  cause: {
    field: RequestChangeFieldValue
    type: string
    change: RequestChange
    payloadIndex?: number
  }

  constructor(
    field: RequestChangeFieldValue,
    type: string,
    change: RequestChange,
    payloadIndex?: number
  ) {
    super(
      `Invalid value for: "${field.column_name}". It is not of type: "${type}"`
    )

    this.cause = {
      field,
      type,
      change,
      payloadIndex
    }
  }
}

export class TypeColumnMismatchError extends Error {
  cause: {
    primaryKey: ChangePrimaryKey
    value: unknown
    column: QueryColumn
  }

  constructor(
    primaryKey: ChangePrimaryKey,
    value: unknown,
    column: QueryColumn
  ) {
    super(`Column has wrong type ${column.type} for value: ${String(value)}`)

    this.cause = {
      primaryKey,
      value,
      column
    }
  }
}
