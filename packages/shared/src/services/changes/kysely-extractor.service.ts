import { sql } from 'kysely'

import { getDb } from '../..'
import { UnknownValueError } from '../../errors/change-requests/unknown.error'
import { validateFieldValues } from '../../services/changes/validation.service'
import * as ChangeService from '../changes/change.service'
import { getPrimaryKeys } from '../kysely/snapshot/column.service'
import { getTableFromCurrentSnapshot } from '../kysely/snapshot/table.service'

import type * as ChangeType from '../../types/change-request.types'
import type { ColumnSelect } from '../../types/kysely/snapshot/column.type'
import type { RawBuilder } from 'kysely'

export class KyselyExtractor {
  public fieldValuesMap: Map<string, ChangeType.ChangeFieldValueSelect[]> =
    new Map()

  public primaryKeysMap: Map<string, ChangeType.ChangePrimaryKeySelect[]> =
    new Map()

  public primaryKeysForTable: Map<string, ColumnSelect[]> = new Map()

  constructor(
    private readonly changeRequest: ChangeType.ChangeRequestSelect,
    private readonly changes: ChangeType.ChangeSelect[]
  ) {}

  // the kysely rawbuilder overloads .then() to block Promises
  // https://github.com/kysely-org/kysely/blob/2c3603e18c91b474b03a4a1c71597fbc37593e95/src/raw-builder/raw-builder.ts#L209
  // so we need to do all data fetching BEFORE we call extractSQL()
  public async setupChanges() {
    await Promise.all(
      this.changes.map(async change => {
        this.fieldValuesMap.set(
          change.id,
          await ChangeService.getFieldValuesForChange(getDb(), change.id)
        )
        this.primaryKeysMap.set(
          change.id,
          await ChangeService.getPrimaryKeysForChange(getDb(), change.id)
        )

        // validate our changes
        await validateFieldValues({
          change,
          connectionId: this.changeRequest.metadata_database_connection_id,
          databaseName: this.changeRequest.metadata_database_raw_name,
          fields: this.fieldValuesMap.get(change.id)!
        })

        // set primary keys for ADD actions
        if (change.action === 'ADD') {
          const table = await getTableFromCurrentSnapshot(
            this.changeRequest.metadata_database_connection_id,
            this.changeRequest.metadata_database_raw_name,
            change.metadata_schema_name,
            change.metadata_table_name
          )

          if (!table) {
            throw new Error('table not found')
          }

          if (!this.primaryKeysForTable.has(change.id)) {
            const tablePrimaryKeys = await getPrimaryKeys(table.id)
            this.primaryKeysForTable.set(change.id, tablePrimaryKeys)
          }
        }
      })
    )
  }

  public extractSQL() {
    const statements = this.changes.map(change => {
      const extracted = this.extractSQLForChange(change)
      return {
        change: change,
        statement: extracted.query,
        keys: extracted.keys
      }
    })
    return statements
  }

  private extractSQLForChange(change: ChangeType.ChangeSelect): {
    query: RawBuilder<unknown>
    keys?: string[]
  } {
    const action = change.action

    switch (action) {
      case 'ADD':
        return this.generateSQLForAdd(change)
      case 'MODIFY':
        return this.generateSQLForModify(change)
      case 'DELETE':
        return this.generateSQLForDelete(change)
      default:
        throw new Error('unknown action')
    }
  }

  public static getClause(
    change: ChangeType.ChangeSelect,
    values:
      | ChangeType.ChangeFieldValueSelect[]
      | ChangeType.ChangePrimaryKeySelect[]
  ) {
    const rawValues = KyselyExtractor.generateRawValues(change, values)
    const keyNames = values.map(v => v.column_name)
    const clauses = keyNames.map(
      col => sql`${sql.id(col)} ${sql.raw('=')} ${sql.val(rawValues.get(col))}`
    )

    return clauses
  }

  private generateSQLForDelete(change: ChangeType.ChangeSelect) {
    const keyValues = KyselyExtractor.getClause(
      change,
      this.primaryKeysMap.get(change.id)!
    )

    const query = sql`DELETE FROM ${sql.id(
      change.metadata_database_name,
      change.metadata_schema_name,
      change.metadata_table_name
    )} WHERE ${sql.join(keyValues, sql` ${sql.raw('AND')} `)};`

    return { query }
  }

  private generateSQLForModify(change: ChangeType.ChangeSelect) {
    const fieldValues = KyselyExtractor.getClause(
      change,
      this.fieldValuesMap.get(change.id)!
    )
    const keyValues = KyselyExtractor.getClause(
      change,
      this.primaryKeysMap.get(change.id)!
    )

    const query = sql`UPDATE ${sql.id(
      change.metadata_database_name,
      change.metadata_schema_name,
      change.metadata_table_name
    )} SET ${sql.join(fieldValues, sql`, `)} WHERE ${sql.join(
      keyValues,
      sql` ${sql.raw('AND')} `
    )};`

    return { query }
  }

  private generateSQLForAdd(change: ChangeType.ChangeSelect) {
    const fieldValues = this.fieldValuesMap.get(change.id)!
    const primaryKeyColumns = this.primaryKeysForTable.get(change.id)!

    const cols = sql.join(fieldValues.map(v => sql.id(v.column_name)))
    const pkCols = sql.join(primaryKeyColumns.map(v => sql.id(v.name)))

    const rawValues = KyselyExtractor.generateRawValues(change, fieldValues)
    const values = Array.from(rawValues.values()).map(v => sql.val(v))

    const query = sql`INSERT INTO ${sql.id(
      change.metadata_database_name,
      change.metadata_schema_name,
      change.metadata_table_name
    )} (${cols}) VALUES (${sql.join(values, sql`, `)}) RETURNING ${pkCols};`

    return { query, keys: primaryKeyColumns.map(v => v.name) }
  }

  private static generateRawValues(
    change: ChangeType.ChangeSelect,
    fieldValues:
      | ChangeType.ChangeFieldValueSelect[]
      | ChangeType.ChangePrimaryKeySelect[]
  ) {
    const values = new Map<string, string | null | Date>([])
    for (const value of fieldValues) {
      if ('is_value_null' in value && value.is_value_null) {
        // PK cannot be null
        values.set(value.column_name, null)
      } else if (value.boolean_value !== null) {
        values.set(value.column_name, value.boolean_value ? 'TRUE' : 'FALSE')
      } else if (value.date_value !== null) {
        values.set(value.column_name, value.date_value)
      } else if (value.numeric_value !== null) {
        values.set(value.column_name, value.numeric_value.toString())
      } else if (value.string_value !== null) {
        values.set(value.column_name, value.string_value)
      } else if (value.uuid_value !== null) {
        values.set(value.column_name, value.uuid_value)
      } else if (value.json_value !== null) {
        values.set(value.column_name, JSON.stringify(value.json_value))
      } else if (value.binary_value !== null) {
        values.set(value.column_name, value.binary_value.toString('base64'))
      } else {
        throw new UnknownValueError(value, change)
      }
    }
    return values
  }
}
