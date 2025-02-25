import { defaults as tsjPreset } from 'ts-jest/presets'

import type { JestConfigWithTsJest } from 'ts-jest'

const config: JestConfigWithTsJest = {
  transform: {
    ...tsjPreset.transform
  },
  setupFiles: ['dotenv/config', './jest.setup.ts'],
  globalTeardown: './jest.teardown.ts',
  rootDir: './src',
  restoreMocks: true,
  clearMocks: true,
}

export default config
