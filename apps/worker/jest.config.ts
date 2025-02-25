import { defaults as tsjPreset } from 'ts-jest/presets'

import type { JestConfigWithTsJest } from 'ts-jest'

const config: JestConfigWithTsJest = {
  transform: {
    ...tsjPreset.transform
  },
  verbose: true,
  setupFiles: ['./jest.setup.ts'],
  rootDir: './src',
  automock: false,
  resetModules: true,
  restoreMocks: true,
  clearMocks: true,
}

export default config
