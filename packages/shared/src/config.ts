import { Type } from '@sinclair/typebox'
import * as Config from '@sort/config'

import type { Static } from '@sinclair/typebox'

const configSchema = Type.Object({
  APP_VERSION: Type.String(),
  ENV: Type.String(),
  IS_TEST_ENV: Type.Boolean(),
  IS_PROD_ENV: Type.Boolean(),
  LOG_LEVEL: Type.String(),

  POSTGRES_DB: Type.String({ default: 'sort_xyz' }),
  POSTGRES_HOST: Type.String({ default: 'localhost:5432' }),
  POSTGRES_USER: Type.String({ default: 'root' }),
  POSTGRES_PASSWORD: Type.String({ default: 'dbadmin' }),
  POSTGRES_MAX_POOL_CLIENTS: Type.Number({ default: 100 }), // development: 832, production: 1690
  USER_FACING_EXTERNAL_DB_CONNECTION_TIMEOUT_MS: Type.Number({
    default: 10000
  }), // used for UI dependent calls
  MAILGUN_ALL_CUSTOMERS_LIST: Type.Optional(Type.String()),
  MAILGUN_API_KEY: Type.Optional(Type.String()),
  MAILGUN_DOMAIN: Type.Optional(Type.String()),
  DB_FIELD_ENCRYPTION_KEY: Type.String(),
  SORTUI_SERVICE_ACCOUNT_EMAIL: Type.String(),
  SLACK_WEBHOOK_URL: Type.Optional(Type.String()),
  SORT_PUBLIC_BOT_SERVICE_ACCOUNT_EMAIL: Type.String(), // the public service account used by change request worker
  CUSTOMER_QUERY_TIMEOUT_MS: Type.Number({ default: 30000 }),
  SORTHUB_HOST: Type.String(),
  IS_LOCAL_DB_CONNECTION_OK: Type.Boolean({ default: false }),
  // connection strings for testing
  TEST_SNOWFLAKE_HYBRID_CONNECTION_STRING: Type.Optional(Type.String()),
  TEST_SNOWFLAKE_HYBRID_USER: Type.Optional(Type.String()),
  TEST_SNOWFLAKE_UNLOCK_CONNECTION_STRING: Type.Optional(Type.String()),
  TEST_POSTGRES_AIR_QUALITY_CONNECTION_STRING: Type.Optional(Type.String())
})

export type SortKyselyConfig = Static<typeof configSchema>

const postEnvLoad = (env: Record<string, unknown>) => {
  // SORTHUB_HOST is used in Invite templates for links to our UI where the
  // customer accepts the invite. For both production and local testing its
  // clear what the origin should be. However, in staging we don't know the
  // domain of the vercel preview env so we just default to production.
  if (!env.SORTHUB_HOST) {
    env.SORTHUB_HOST = /localhost/i.test(String(env.SERVICE_URL))
      ? 'http://localhost:3000'
      : 'https://sort.xyz'
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

    if (!env.DB_FIELD_ENCRYPTION_KEY) {
      env.DB_FIELD_ENCRYPTION_KEY =
        'AIEVXVpAJQv3TW04k79A6Q+hT7F5v+MLrl0FcsNF4cT/yukOXjOVetpf'
    }

    if (!env.TEST_SNOWFLAKE_HYBRID_CONNECTION_STRING) {
      throw new Error(
        'Missing env var: TEST_SNOWFLAKE_HYBRID_CONNECTION_STRING\n' +
          'Hint: create a .env.test file in the root of this package (packages/shared) and add TEST_SNOWFLAKE_HYBRID_CONNECTION_STRING=... to it.'
      )
    }

    if (!env.TEST_SNOWFLAKE_HYBRID_USER) {
      throw new Error(
        'Missing env var: TEST_SNOWFLAKE_HYBRID_USER\n' +
          'Hint: create a .env.test file in the root of this package (packages/shared) and add TEST_SNOWFLAKE_HYBRID_USER=... to it.'
      )
    }

    if (!env.TEST_SNOWFLAKE_UNLOCK_CONNECTION_STRING) {
      throw new Error(
        'Missing env var: TEST_SNOWFLAKE_UNLOCK_CONNECTION_STRING\n' +
          'Hint: create a .env.test file in the root of this package (packages/shared) and add TEST_SNOWFLAKE_HYBRID_PASSWORD=... to it.'
      )
    }

    if (!env.TEST_POSTGRES_AIR_QUALITY_CONNECTION_STRING) {
      throw new Error(
        'Missing env var: TEST_POSTGRES_AIR_QUALITY_CONNECTION_STRING\n' +
          'Hint: create a .env.test file in the root of this package (packages/shared) and add TEST_POSTGRES_AIR_QUALITY_CONNECTION_STRING=... to it.'
      )
    }
  }

  if (/^\s|\s$/.test(String(env.DB_FIELD_ENCRYPTION_KEY))) {
    throw new Error(
      'DB_FIELD_ENCRYPTION_KEY env var must not start or end with whitespace.'
    )
  }
}

let config = Config.configure({
  directory: './',
  schema: configSchema,
  postEnvLoad
})

export const getConfig = () => config

const CONFIG_DEFAULTS = {
  MAILGUN_ALL_CUSTOMERS_LIST:
    'all@sandbox7e4efdd6b47e4c2e934d48a4930dbffe.mailgun.org',
  SORTUI_SERVICE_ACCOUNT_EMAIL: 'svc-sortui-test@sort.xyz',
  IS_TEST_ENV: true
}

export const setConfig = (newConfig: SortKyselyConfig) => {
  config = { ...CONFIG_DEFAULTS, ...newConfig }
}
