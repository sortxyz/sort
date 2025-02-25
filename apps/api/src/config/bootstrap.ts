import * as Sentry from '@sentry/node'
import { Type } from '@sinclair/typebox'
import * as Config from '@sort/config'
import { createLogger } from '@sort/logger'

import type { Static } from '@sinclair/typebox'

const configSchema = Type.Object({
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
  SENTRY_TRACE_RATE: Type.Number({ default: 1 }),
  SERVICE_HOST: Type.String({ default: '0.0.0.0' }),
  SERVICE_PORT: Type.Number({ default: 8080 }),
  SERVICE_URL: Type.String({ default: 'http://localhost:8080' }),
  SERVICE_RATE_LIMIT_MAX: Type.Number({ default: 100 }),
  SERVICE_RATE_LIMIT_TIME_WINDOW: Type.String({ default: '1s' }),
  MAILGUN_API_KEY: Type.Optional(Type.String()),
  MAILGUN_DOMAIN: Type.Optional(Type.String()),
  MAILGUN_ALL_CUSTOMERS_LIST: Type.Optional(Type.String()),
  SLACK_WEBHOOK_URL: Type.Optional(Type.String()),
  EXTERNAL_DB_CONNECTION_TIMEOUT_MS: Type.Number({ default: 30000 }),
  USER_FACING_EXTERNAL_DB_CONNECTION_TIMEOUT_MS: Type.Number({
    default: 10000
  }),
  SORTHUB_HOST: Type.String(),
  SORT_JWT_SECRET: Type.String(),
  AUTH0_ISSUER_BASE_URL: Type.Optional(Type.String()),
  SORT_SESSION_REVOKE_SECRET: Type.String(),
  SORTUI_SERVICE_ACCOUNT_EMAIL: Type.String(),
  SORT_PUBLIC_BOT_SERVICE_ACCOUNT_EMAIL: Type.String(),
  HOME_ROUTE_MAX_RESULTS: Type.Number({ default: 18 }),
  CUSTOMER_QUERY_TIMEOUT_MS: Type.Number({ default: 30000 }),
  IS_LOCAL_DB_CONNECTION_OK: Type.Boolean({ default: false }),
  MAX_BINARY_STRING_LENGTH: Type.Number({ default: 250_000 }),
  ON_PREM: Type.Boolean({ default: false }),
  TEST_SNOWFLAKE_HYBRID_CONNECTION_STRING: Type.Optional(Type.String()),
  TEST_SNOWFLAKE_HYBRID_USER: Type.Optional(Type.String())
})

// Make Config.getConfig() type aware.
declare module '@sort/config' {
  interface Config extends Static<typeof configSchema> {}
}

const postEnvLoad = (env: Record<string, unknown>) => {
  // SORTHUB_HOST is used in Invite templates for links to our UI where the
  // customer accepts the invite. For both production and local testing its
  // clear what the origin should be. However, in staging we don't know the
  // domain of the vercel preview env so we just default to production.
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

  if (env.SORT_FEAT_ENABLE_ON_PREM_AUTH) {
    if (!env.AUTH0_ISSUER_BASE_URL) {
      env.AUTH0_ISSUER_BASE_URL = ''
    }
  }

  if (env.IS_TEST_ENV) {
    env.MAILGUN_DOMAIN = 'test'
    env.MAILGUN_API_KEY = 'test'
    env.SORT_JWT_SECRET = 'sort'
    // snowflake takes a while to connect, even in the test harness
    env.EXTERNAL_DB_CONNECTION_TIMEOUT_MS = 5000
    env.USER_FACING_EXTERNAL_DB_CONNECTION_TIMEOUT_MS = 5000

    if (!env.AUTH0_ISSUER_BASE_URL) {
      env.AUTH0_ISSUER_BASE_URL = ''
    }
    if (!env.SORT_SESSION_REVOKE_SECRET) {
      env.SORT_SESSION_REVOKE_SECRET = 'test'
    }

    if (!env.DB_FIELD_ENCRYPTION_KEY) {
      env.DB_FIELD_ENCRYPTION_KEY =
        'AIEVXVpAJQv3TW04k79A6Q+hT7F5v+MLrl0FcsNF4cT/yukOXjOVetpf'
    }

    if (!env.TEST_SNOWFLAKE_HYBRID_CONNECTION_STRING) {
      throw new Error(
        'Missing env var: TEST_SNOWFLAKE_HYBRID_CONNECTION_STRING\n' +
          'Hint: create a .env.test file in the root of this app (apps/api) and add TEST_SNOWFLAKE_HYBRID_CONNECTION_STRING=... to it.'
      )
    }

    if (!env.TEST_SNOWFLAKE_HYBRID_USER) {
      throw new Error(
        'Missing env var: TEST_SNOWFLAKE_HYBRID_USER\n' +
          'Hint: create a .env.test file in the root of this app (apps/api) and add TEST_SNOWFLAKE_HYBRID_USER=... to it.'
      )
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
