import type { FullChange } from '../../schemas/change.schema'

export class RowMissingError extends Error {
  change: FullChange

  constructor({ change }: { change: FullChange }) {
    const tbl = `${change.metadata_database_name}.${change.metadata_schema_name}.${change.metadata_table_name}`

    const pk = change.primary_keys
      .map(key => RowMissingError.formatPrimaryKey(key))
      .join(', ')

    super(
      `Row not found. The row you are trying to change does not exist in your database. Table: ${tbl}, Primary Key: (${pk})`
    )

    this.change = change
  }

  static formatPrimaryKey(pk: FullChange['primary_keys'][0]) {
    const val = String(
      pk.uuid_value ??
        pk.string_value ??
        pk.date_value ??
        pk.binary_value ??
        pk.boolean_value ??
        pk.numeric_value ??
        '?'
    )
    return `${pk.column_name}=${val}`
  }
}
