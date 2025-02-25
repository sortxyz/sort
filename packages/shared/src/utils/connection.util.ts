import { Type } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { parseSqlConnectionString } from '@tediousjs/connection-string'
import { Pool } from 'pg'

import { getConfig } from '../bootstrap'

import type { ConnectionDataProvider } from '../schemas/data-provider.schema'
import type { ConnectionSelectWithEncryption } from '../types/kysely/connection/connection.type'
import type { PoolConfig } from 'pg'

/* eslint-disable  @typescript-eslint/no-non-null-assertion */

const objectType = Type.Object({
  'connection lifetime': Type.Optional(Type.Number()),
  database: Type.String(),
  host: Type.Optional(Type.String()),
  'max pool size': Type.Optional(Type.Number()),
  'min pool size': Type.Optional(Type.Number()),
  password: Type.Optional(Type.String()),
  pooling: Type.Optional(Type.Boolean()),
  port: Type.Optional(Type.Number()),
  'user id': Type.Optional(Type.String()),
  uid: Type.Optional(Type.String()),
  pwd: Type.Optional(Type.String()),
  server: Type.Optional(Type.String())
})

const validator = TypeCompiler.Compile(objectType)

export interface ParsedPostgresConnectionString {
  user: string
  password: string
  host: string // typically host
  port: number
  database: string
  connectionTimeoutMillis: number
  server?: string
}

export interface ParsedSnowflakeConnectionString {
  user: string
  password: string
  account: string // usually SOMETHING.snowflakecomputing.com
  database: string
}

export interface IRawConnectionString {
  server: string
  'user id': string
  'connection timeout': string
}

export function buildConnectionString({
  data_provider,
  database,
  host,
  password,
  port,
  user
}: Record<'host' | 'user' | 'password' | 'database', string> & {
  port: number
  data_provider: ConnectionDataProvider
}) {
  switch (data_provider) {
    case 'postgres': {
      const usr = encodeURIComponent(user)
      const pwd = encodeURIComponent(password)
      // postgres:// and postgresql:// are interchangeable
      return `postgres://${usr}:${pwd}@${host}:${port}/${database}`
    }
    case 'snowflake': {
      return `Driver={SnowflakeDSIIDriver};Server=${host};Database=${database};uid=${user};pwd=${password};port=${port}`
    }
    default: {
      throw new Error('Invalid data provider')
    }
  }
}

export const parseSnowflakeConnectionString = (
  connectionString: string
): ParsedSnowflakeConnectionString => {
  const obj = parseSqlConnectionString(connectionString) as Record<
    string,
    unknown
  >

  if (!validator.Check(obj)) {
    throw new Error(`Invalid Snowflake connection string: ${connectionString}`)
  }

  const database = obj.database

  const user = obj['user id'] ?? obj.uid

  if (!user) {
    throw new Error('no user id')
  }

  const password = obj.password ?? obj.pwd

  if (!password) {
    throw new Error('no password')
  }

  // refer to: https://docs.snowflake.com/en/user-guide/admin-account-identifier#using-an-account-locator-as-an-identifier
  const account = obj.server?.replace('.snowflakecomputing.com', '')

  if (!account) {
    throw new Error('no account')
  }

  return {
    user,
    password,
    database,
    account
  }
}

export const changeDatabaseOfConnectionString = ({
  connectionString,
  dbName,
  dataProvider
}: {
  connectionString: string
  dbName: string
  dataProvider: ConnectionDataProvider
}): string => {
  switch (dataProvider) {
    case 'postgres': {
      const url = new URL(connectionString)
      url.pathname = `/${dbName}`
      return url.toString()
    }
    case 'snowflake': {
      return connectionString.replace(/Database=[^;]+/i, `Database=${dbName}`)
    }
    default: {
      throw new Error('Invalid data provider')
    }
  }
}

export const createPg7Pool = (
  connectionString: string,
  withSsl: boolean,
  baseConfig?: Omit<PoolConfig, 'connectionString' | 'ssl'>
): Pool => {
  const poolConfig: PoolConfig = baseConfig
    ? {
        connectionTimeoutMillis:
          getConfig().USER_FACING_EXTERNAL_DB_CONNECTION_TIMEOUT_MS,
        ...baseConfig,
        connectionString
      }
    : {
        connectionTimeoutMillis:
          getConfig().USER_FACING_EXTERNAL_DB_CONNECTION_TIMEOUT_MS,
        connectionString,
        max: 5
      }

  if (withSsl) {
    poolConfig.ssl = {
      rejectUnauthorized: false,
      requestCert: true
    }
  }

  return new Pool(poolConfig)
}

export const sanitizeConnectionForResponse = (
  conn: ConnectionSelectWithEncryption
) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { connection_string: ignore, ...result } = conn
  return result
}
