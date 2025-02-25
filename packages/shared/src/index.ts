/* eslint-disable import/order */

/**
 * IMPORT ORDER MATTERS! Our current codebase was designed to be imported
 * in a specific order with bootstrap.ts being imported first because it
 * sets up configuration used by most other modules.
 *
 * DO NOT USE `export *` in this module. It breaks `jest.spyOn` in tests.
 * Instead, `import * as Whatever` and then `export { Whatever }`.
 */
import {
  getDb,
  getConfig,
  logger,
  createKysely,
  disconnectKysely
} from './bootstrap'

export { getDb, getConfig, logger, createKysely, disconnectKysely }
