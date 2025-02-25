export class PrimaryKeyMatchError extends Error {
  constructor(changeId: string, changeRequestId: string) {
    super(
      `Submitted primary keys must match underlying table primary keys for change ${changeId} in change request ${changeRequestId}`
    )
  }
}

export class PrimaryKeyDoesNotExistError extends Error {
  constructor(passedPrimaryKeyName: string, tableName: string) {
    super(
      `Submitted primary key ${passedPrimaryKeyName} does not exist in table ${tableName}`
    )
  }
}
