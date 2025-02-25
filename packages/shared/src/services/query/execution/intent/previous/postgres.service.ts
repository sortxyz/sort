import { sql } from 'kysely'

import { dbMapper } from '../../../../changes/change.service'
import { KyselyExtractor } from '../../../../changes/kysely-extractor.service'
import { PostgresIntentQueryService } from '../postgres.service'

import type {
  ChangePrimaryKey,
  FullChange
} from '../../../../../schemas/change.schema'
import type { IntentQuery } from '../../../../../schemas/query-execution.schema'
import type { ChangeSelect } from '../../../../../types/change-request.types'
import type { ConnectionSelectWithEncryption } from '../../../../../types/kysely/connection/connection.type'
import type { RawBuilder } from 'kysely'

// TODO: intended for only internal use, we'll need to gate this to a query type and add some more guards around it
export class PostgresPreviousQueryService extends PostgresIntentQueryService {
  constructor(
    protected readonly connection: ConnectionSelectWithEncryption,
    protected readonly changes: FullChange[]
  ) {
    if (changes.length === 0) {
      throw new Error('No changes provided')
    }

    super(connection)
  }

  protected createWhereClause(_: IntentQuery) {
    const combinedWheres: RawBuilder<unknown>[] = []

    for (const changeWithPks of this.changes) {
      const clause = this.buildChangeClause(
        changeWithPks,
        changeWithPks.primary_keys
      )

      const guard = sql`( ${clause} )`

      combinedWheres.push(guard)
    }

    const where = combinedWheres.length
      ? sql`WHERE ${sql.join(combinedWheres, sql` ${sql.raw('OR')} `)}`
      : sql.raw('')

    return where
  }

  protected createOrderByClause(_: IntentQuery) {
    return sql``
  }

  private buildChangeClause(
    change: ChangeSelect,
    primaryKeys: ChangePrimaryKey[]
  ) {
    const clauses = KyselyExtractor.getClause(change, primaryKeys.map(dbMapper))

    const pkWhere = clauses.length
      ? sql.join(clauses, sql` ${sql.raw('AND')} `)
      : sql.raw('')

    return pkWhere
  }
}
