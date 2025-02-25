import { defaults as tsjPreset } from 'ts-jest/presets'

import type { JestConfigWithTsJest } from 'ts-jest'

const config: JestConfigWithTsJest = {
  transform: {
    ...tsjPreset.transform
  },
  setupFiles: [],
  rootDir: './src'
}

export default config
