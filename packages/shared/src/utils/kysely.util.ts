import { Kysely, PostgresDialect, sql } from 'kysely'
import { Pool } from 'pg'

import { toNumber } from './js.util'

import type { SortDB, KyselySortDB } from '../types/kysely.type'
import type { KyselyConfig, LogConfig, RawBuilder } from 'kysely'

type createKyselyArgs = {
  POSTGRES_HOST?: string
  POSTGRES_USER?: string
  POSTGRES_PASSWORD?: string
  POSTGRES_DB?: string
  POSTGRES_MAX_POOL_CLIENTS?: number
  IS_TEST_ENV?: boolean
  LOG_LEVEL?: string
}

export const toDbParams = (config: createKyselyArgs) => {
  const { POSTGRES_HOST, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB } =
    config

  const pgHost = POSTGRES_HOST ?? 'localhost'
  const host = pgHost.includes(':') ? pgHost.split(':')[0] : pgHost
  const port = pgHost.includes(':')
    ? toNumber(pgHost.split(':')[1], 5432)
    : 5432

  const user = POSTGRES_USER || 'root'
  const password = POSTGRES_PASSWORD || 'dbadmin'
  const database = POSTGRES_DB || 'sort_xyz'

  return {
    host,
    port,
    user,
    password,
    database
  }
}

export const createKysely = (config: createKyselyArgs) => {
  const { host, port, user, password, database } = toDbParams(config)

  const pool = new Pool({
    database,
    host,
    user,
    password,
    port,
    max: config.POSTGRES_MAX_POOL_CLIENTS || 100
  })

  const dialect = new PostgresDialect({
    pool
  })

  const { IS_TEST_ENV, LOG_LEVEL } = config
  const log: LogConfig = IS_TEST_ENV && LOG_LEVEL === 'debug' ? ['error'] : []

  const kyselyConfig = {
    dialect,
    log
  } satisfies KyselyConfig

  const db = new Kysely<SortDB>(kyselyConfig)

  return db satisfies KyselySortDB
}

// https://kysely.dev/docs/recipes/extending-kysely
export const toJSONB = <T>(value: T): RawBuilder<T> | undefined => {
  if (value) {
    if (typeof value === 'string') {
      return sql`CAST (${value} AS JSONB)`
    }

    return sql`CAST (${JSON.stringify(value)} AS JSONB)`
  }

  return undefined
}
