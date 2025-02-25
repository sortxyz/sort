import { Pool } from 'pg'

import { config } from '../config/bootstrap'

import type { PoolConfig } from 'pg'

export const createPgPool = (
  connectionString: string,
  withSsl: boolean,
  baseConfig?: Omit<PoolConfig, 'connectionString' | 'ssl'>
): Pool => {
  const poolConfig: PoolConfig = baseConfig
    ? {
        connectionTimeoutMillis: config.EXTERNAL_DB_CONNECTION_TIMEOUT_MS,
        ...baseConfig,
        connectionString
      }
    : {
        connectionTimeoutMillis: config.EXTERNAL_DB_CONNECTION_TIMEOUT_MS,
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
