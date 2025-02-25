import { parse } from 'pgsql-ast-parser'

import { BaseValidationQueryService } from './base.service'

import type { ConnectionDataProvider } from '../../../schemas/data-provider.schema'
import type { QueryValidation } from '../../../schemas/query-validation.schema'
import type { Statement } from 'pgsql-ast-parser'

export type UserDefinedFunc = {
  type: 'function'
  name: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any[]
}

const isSqlSyntaxError = (e: unknown): e is Error => {
  return (
    e instanceof Error &&
    (e.message.indexOf('Syntax error at line') > -1 ||
      e.message.indexOf('invalid syntax at line') > -1)
  )
}

const isUnexpectedEndOfInputError = (e: unknown): e is Error => {
  return e instanceof Error && /Unexpected end of input/.test(e.message)
}

export class SqlValidationQueryService extends BaseValidationQueryService {
  constructor(
    connectionId: string,
    dataProvider: ConnectionDataProvider,
    sql: string
  ) {
    super(connectionId, dataProvider, sql)
  }

  translateIntoQueryValidationDataProvider(
    sortDb: ConnectionDataProvider
  ): string {
    switch (sortDb) {
      case 'postgres':
        return 'postgresql'
      case 'snowflake':
        // currently in alpha for parsing
        return 'snowflake'
      default:
        throw new Error('Invalid data provider')
    }
  }

  isSelectStatement(stmt: Statement | undefined): boolean {
    if (!stmt) return false

    if (stmt.type === 'with') {
      return stmt.in.type === 'select'
    }

    return stmt.type === 'select'
  }

  // you can find the AST SELECT tests here: https://github.com/taozhi8833998/node-sql-parser/blob/master/test/select.spec.js
  validate(): QueryValidation {
    try {
      // TODO: validate that all DBs in the query == our DB
      // TODO: validate that all schemas in the query == our schemas

      const parsedAst = parse(this.sql)

      // - one to two query guard
      const allAsts = parsedAst instanceof Array ? parsedAst : [parsedAst]
      if (allAsts.length > 2) {
        return {
          database: this.dataProvider,
          query: this.sql,
          is_sort_queryable: false,
          error:
            'Only one SELECT query with one SET is supported; or one SELECT query'
        }
      }

      // the AST d.ts from the library is wrong, so we need to cast to a more accurate type
      const firstAst = allAsts[0]
      const secondAst = allAsts.length > 1 ? allAsts[1] : undefined

      // for one AST, the first one needs to be a SELECT
      // for two ASTs, the second one needs to be a SELECT

      // - non-SELECT guard
      if (
        (secondAst && !this.isSelectStatement(secondAst)) ||
        (!secondAst && !this.isSelectStatement(firstAst))
      ) {
        return {
          database: this.dataProvider,
          query: this.sql,
          is_sort_queryable: false,
          error: 'Only SELECT statements are supported'
        }
      }

      if (secondAst && firstAst.type !== 'set') {
        return {
          database: this.dataProvider,
          query: this.sql,
          is_sort_queryable: false,
          error: 'Only one SELECT query with one SET is supported'
        }
      }

      return {
        database: this.dataProvider,
        query: this.sql,
        is_sort_queryable: true
      }
    } catch (e: unknown) {
      if (isSqlSyntaxError(e)) {
        const index = e.message.indexOf('^')
        const msg = e.message.substring(0, index)
        return {
          database: this.dataProvider,
          query: this.sql,
          is_sort_queryable: false,
          error: msg
        }
      }

      if (isUnexpectedEndOfInputError(e)) {
        return {
          database: this.dataProvider,
          query: this.sql,
          is_sort_queryable: false
        }
      }

      throw e
    }
  }
}
