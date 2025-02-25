import {
  createKysely as createSharedKysely,
  getDb,
  disconnectKysely
} from '@sort/shared'

import { config as appConfig } from '../../config/bootstrap'
import { logger } from '../utils/log.util'

export const createKysely = () => {
  createSharedKysely({ config: appConfig, sortLogger: logger })
}

export { getDb, disconnectKysely }
