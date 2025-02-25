import { getConfig, logger } from '../../bootstrap'
import { QueryTimeoutError } from '../../errors'

import type { Pool } from 'generic-pool'
import type * as Snowflake from 'snowflake-sdk'

export type SnowflakeRowModes =
  | 'object'
  | 'object_with_renamed_duplicated_columns'
  | 'array'

/**
 * Helper to run a pool query and return the rows of `TRow` type
 * @param snowflakePool - pool to run the query on
 * @param sqlText - text of the query to run
 * @param binds - passthrough for snowflake sdk to execute statements,
 *  see {@link https://docs.snowflake.com/en/developer-guide/node-js/nodejs-driver-execute#binding-statement-parameters Binding Statement Parameters}
 * @returns rows in the form of TRow or rejects with no rows returned
 */
export async function runQuery<TRow>({
  snowflakePool,
  sqlText,
  binds,
  rowMode
}: {
  snowflakePool: Pool<Snowflake.Connection>
  sqlText: string
  binds?: Snowflake.Binds
  rowMode?: SnowflakeRowModes
}) {
  return snowflakePool.use(clientConnection => {
    return new Promise<TRow[]>((resolve, reject) => {
      executeStatement<TRow>({
        resolve,
        reject,
        clientConnection,
        sqlText,
        binds,
        rowMode
      })
    })
  })
}

/**
 * Executes a DML statement in Snowflake with rows.
 * @param resolve
 * @param reject
 * @param clientConnection - create client connection, should be open already
 * @param sqlText
 * @param binds - passthrough for snowflake sdk to execute statements,
 *  see {@link https://docs.snowflake.com/en/developer-guide/node-js/nodejs-driver-execute#binding-statement-parameters Binding Statement Parameters}
 */
export function executeStatement<TRow>({
  resolve,
  reject,
  clientConnection,
  sqlText,
  binds,
  rowMode
}: {
  resolve: (value: TRow[] | PromiseLike<TRow[]>) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reject: (reason?: any) => void
  clientConnection: Snowflake.Connection
  sqlText: string
  binds?: Snowflake.Binds
  rowMode?: SnowflakeRowModes
}) {
  if (!clientConnection.isUp()) {
    reject(new Error('Connection is not up'))
    return
  }

  const statement = clientConnection.execute({
    sqlText: sqlText,
    rowMode: rowMode ?? 'object',
    binds,
    complete: (err, stmt, rows) => {
      clearTimeout(timer)

      if (err) {
        reject(err)
        return
      }

      if (rows && rows.length) {
        return resolve(rows as TRow[])
      }

      if (rows && rows.length === 0) {
        return resolve([])
      }

      reject(new Error('rows is not an object or array'))
    }
  })

  const timer = setTimeout(() => {
    reject(new QueryTimeoutError('Query read timeout'))
    statement.cancel((err: unknown) => {
      logger.debug('Snowflake cancel response', err as object)
    })
  }, getConfig().CUSTOMER_QUERY_TIMEOUT_MS)
  timer.unref()
}
