import { resolve } from 'node:path'

import { Static, type TObject } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'
import * as dotenv from 'dotenv'

import { getAppVersion } from './version'

/**
 * Returns the last configuration populated by the `configure` function
 * which must be called first or an `Error` will be thrown.
 */
export const getConfig = () => {
  if (!config) {
    throw new Error('Configuration not loaded. Call `configure()` first.')
  }
  return config
}

export interface Config {}

let config: Config

/**
 * Returns a validated configuration object loaded from the environment.  This function is
 * based on `dotenv` so it will look for an appropriate .env file in the given
 * `directory`.
 *
 * In addition to the env variables, the returned config object
 * also contains:
 * - `APP_VERSION` the apps package.json version, or 'unknown' if available.
 * - `ENV` represents the current environment (e.g. `development`, `test`, `production`).
 * - `IS_TEST_ENV` is a boolean indicating if the current environment is `test`.
 * - `IS_PROD_ENV` is a boolean indicating if the current environment is `production`.
 * - `LOG_LEVEL` is the log level to use. Defaults to `info`.
 *
 * @param directory - The directory in which to look for the configuration file (`.env.{production,development,test}`).
 * @param schema - The `@sinclari/typebox` schema of the expected configuration object. This is used to validate the environment configuration.
 * @param postEnvLoad - An optional function which is passed the parsed environment configuration object _before_ it is validated against the given `schema`. Use this to set custom configuration settings based on other values in the environment.
 * @throws `Error` if the `.env` file is not found or if there is an error parsing it.
 * @throws `@sinclair/typebox/value/transform` `TransformDecodeCheckError` if the environment configuration does not match the schema.
 */
export const configure = <T extends TObject>({
  directory,
  schema,
  postEnvLoad
}: {
  directory: string
  schema: T
  postEnvLoad?: (env: Record<string, unknown>) => void
}): Static<T> => {
  const ENV = process.env.NODE_ENV || 'development'
  const fileName = `.env.${ENV}`
  const conf = dotenv.config({
    path: resolve(directory, fileName)
  })

  if (conf.error) {
    if ((conf.error as Error & { code: string }).code !== 'ENOENT') {
      throw conf.error
    }
  }

  const cloned = Value.Clone(process.env) as Record<string, unknown>
  const defaulted = Value.Default(schema, cloned) as Record<string, unknown>
  const converted = Value.Convert(schema, defaulted) as Record<string, unknown>

  const result: Record<string, unknown> = {
    ENV,
    IS_TEST_ENV: ENV === 'test',
    IS_PROD_ENV: ENV === 'production',
    APP_VERSION: getAppVersion({ directory }),
    ...converted
  }

  if (!result.LOG_LEVEL) result.LOG_LEVEL = 'info'

  if (postEnvLoad) postEnvLoad(result)

  const ordered = alphabetize(result)
  const s = Value.Decode<T, Record<string, unknown>>(schema, ordered)
  config = s
  return s
}

/**
 * Returns a clone of the given `object` with all the key/val pairs but in
 * alphabetical order by key. This makes visually inspecting the configuration
 * easier.
 */
const alphabetize = (object: Record<string, unknown>) => {
  const ret: Record<string, unknown> = {}
  const keys = Object.keys(object).sort()

  for (const key of keys) {
    ret[key] = object[key]
  }

  return ret
}
