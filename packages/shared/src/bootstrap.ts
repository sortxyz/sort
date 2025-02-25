import { createLogger } from '@sort/logger'

import { getConfig, setConfig } from './config'
import { createKysely as createSharedKysely } from './utils/kysely.util'

import type { SortKyselyConfig } from './config'
import type { SortDB } from './types/kysely.type'
import type { SortLogger } from '@sort/logger'
import type { Kysely } from 'kysely'

export let logger = createLogger({
  LOG_LEVEL: getConfig().LOG_LEVEL,
  APP_VERSION: getConfig().APP_VERSION
})

let db: Kysely<SortDB>
/**
 * Returns the current Kysely instance or throws if createKysely() has not been run.
 */
export const getDb = () => {
  if (!db) {
    throw new Error('You must run createKysely() before getDb().')
  }
  return db
}

export const createKysely = ({
  config: configuration,
  sortLogger
}: {
  config?: SortKyselyConfig
  sortLogger?: SortLogger
} = {}) => {
  // TODO refactor to separate module configuration from kysely creation
  if (sortLogger) logger = sortLogger
  if (configuration) {
    setConfig(configuration)
    logger.debug('config updated')
  }

  db = createSharedKysely(getConfig())

  if (logger) logger.info('kysely: created connection')

  return db
}

export const disconnectKysely = async () => {
  if (db) {
    await db.destroy()
    // @ts-expect-error - reset state
    db = undefined
  }

  if (logger) logger.info('kysely: destroyed connection')
}

export { getConfig }
