import * as Sentry from '@sentry/node'
import { Type } from '@sinclair/typebox'
import * as Config from '@sort/config'
import { createLogger } from '@sort/logger'

import type { Static } from '@sinclair/typebox'

export const configSchema = Type.Object({
  // standard
  APP_VERSION: Type.String(),
  ENV: Type.String(),
  IS_TEST_ENV: Type.Boolean(),
  IS_PROD_ENV: Type.Boolean(),
  LOG_LEVEL: Type.String(),

  // custom
  NODE_ENV: Type.Optional(Type.String()),
  POSTGRES_DB: Type.String({ default: 'sort_xyz' }),
  POSTGRES_HOST: Type.String({ default: 'localhost:5432' }),
  POSTGRES_USER: Type.String({ default: 'root' }),
  POSTGRES_PASSWORD: Type.String({ default: 'dbadmin' }),
  POSTGRES_MAX_POOL_CLIENTS: Type.Number({ default: 100 }),
  DB_FIELD_ENCRYPTION_KEY: Type.String(),
  SENTRY_DSN: Type.Optional(Type.String()),
  EXTERNAL_DB_CONNECTION_TIMEOUT_MS: Type.Number({ default: 30000 }),
  USER_FACING_EXTERNAL_DB_CONNECTION_TIMEOUT_MS: Type.Number({
    default: 10000
  }),
  SENTRY_TRACE_RATE: Type.Optional(Type.Number()),
  SERVICE_URL: Type.String({ default: 'http://localhost:8080' }),
  SORTUI_SERVICE_ACCOUNT_EMAIL: Type.String(),
  SORT_PUBLIC_BOT_SERVICE_ACCOUNT_EMAIL: Type.String(), // the public service account used by change request worker
  HEALTH_SERVICE_HOST: Type.String({ default: '0.0.0.0' }),
  HEALTH_SERVICE_PORT: Type.Number({ default: 8080 }),
  MAILGUN_ALL_CUSTOMERS_LIST: Type.Optional(Type.String()),
  MAILGUN_API_KEY: Type.Optional(Type.String()),
  MAILGUN_DOMAIN: Type.Optional(Type.String()),
  CHANGE_JOB_EXPIRATION_MINUTES: Type.Number({ default: 30 }),
  SCHEMA_IMPORT_JOB_EXPIRATION_MINUTES: Type.Number({ default: 15 }),
  CUSTOMER_QUERY_TIMEOUT_MS: Type.Number({ default: 30000 }),
  IS_LOCAL_DB_CONNECTION_OK: Type.Boolean({ default: false }),
  SORTHUB_HOST: Type.String()
})

// Make Config.getConfig() type aware.
declare module '@sort/config' {
  interface Config extends Static<typeof configSchema> {}
}

const postEnvLoad = (env: Record<string, unknown>) => {
  if (!env.SORTHUB_HOST) {
    env.SORTHUB_HOST = env.IS_PROD_ENV
      ? 'https://sort.xyz'
      : 'http://localhost:3000'
  }

  if (!env.IS_PROD_ENV) {
    if (!env.SORTUI_SERVICE_ACCOUNT_EMAIL) {
      env.SORTUI_SERVICE_ACCOUNT_EMAIL = 'svc-sortui-test@sort.xyz'
    }

    if (!env.SORT_PUBLIC_BOT_SERVICE_ACCOUNT_EMAIL) {
      env.SORT_PUBLIC_BOT_SERVICE_ACCOUNT_EMAIL = 'svc-sort-bot-test@sort.xyz'
    }

    if (!env.MAILGUN_ALL_CUSTOMERS_LIST) {
      env.MAILGUN_ALL_CUSTOMERS_LIST =
        'all@sandbox7e4efdd6b47e4c2e934d48a4930dbffe.mailgun.org'
    }
  }

  if (env.IS_TEST_ENV) {
    env.MAILGUN_DOMAIN = 'test'
    env.MAILGUN_API_KEY = 'test'
    env.EXTERNAL_DB_CONNECTION_TIMEOUT_MS = 5000
    env.USER_FACING_EXTERNAL_DB_CONNECTION_TIMEOUT_MS = 5000

    if (!env.DB_FIELD_ENCRYPTION_KEY) {
      env.DB_FIELD_ENCRYPTION_KEY =
        'AIEVXVpAJQv3TW04k79A6Q+hT7F5v+MLrl0FcsNF4cT/yukOXjOVetpf'
    }
  }

  if (/^\s|\s$/.test(String(env.DB_FIELD_ENCRYPTION_KEY))) {
    throw new Error(
      'DB_FIELD_ENCRYPTION_KEY env var must not start or end with whitespace.'
    )
  }
}

export const config = Config.configure({
  directory: './',
  schema: configSchema,
  postEnvLoad
})

Sentry.init({
  dsn: config.SENTRY_DSN,
  tracesSampleRate: config.SENTRY_TRACE_RATE ?? 0,
  environment: config.ENV,
  release: config.APP_VERSION,
  integrations: [
    Sentry.captureConsoleIntegration({
      levels: ['warn']
    })
  ]
})

export const logger = createLogger({
  LOG_LEVEL: config.LOG_LEVEL,
  APP_VERSION: config.APP_VERSION
})

if (config.LOG_LEVEL === 'debug') {
  logger.debug(config, 'config')
}
