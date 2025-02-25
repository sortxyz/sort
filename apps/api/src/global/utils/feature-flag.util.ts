import { config } from '../../config/bootstrap'
const { IS_TEST_ENV } = config

import { logger } from './log.util'

export const isFeatureEnabled = (
  key: string,
  enableAllValuesInTestEnv = true // allow override for testing purposes
): boolean => {
  let ret = false
  const name = key.startsWith('SORT_FEAT_ENABLE_')
    ? key
    : `SORT_FEAT_ENABLE_${key}`

  if (enableAllValuesInTestEnv && IS_TEST_ENV) {
    ret = true
  } else {
    ret = process.env[name] === 'true' || process.env[name] === '1'
  }

  logger.info(`Feature flag: ${name} = ${ret}`)

  return ret
}
