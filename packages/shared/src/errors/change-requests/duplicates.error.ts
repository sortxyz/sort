export class DuplicateUniqueIndexError extends Error {
  code = 'NO_DUPLICATE_INDEX'
  cause: {
    index: number
  }

  constructor(
    name: string,
    options: {
      cause: { index: number }
    }
  ) {
    super(
      `Duplicate unique index for action ${name} with index: '${options.cause.index}'`
    )
    this.cause = options.cause
  }
}

export class DuplicateColumnNameError extends Error {
  constructor(columnNames: string[]) {
    super(`Duplicate column names are not allowed: ${columnNames.join(', ')}`)
  }
}
