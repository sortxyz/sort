import { StringEnum } from './api.schema'

import type { Static } from '@sinclair/typebox'

export const ConnectionDataProviderNames = ['postgres', 'snowflake'] as const

export const ConnectionDataProviderSchema = StringEnum([
  ...ConnectionDataProviderNames
])
export type ConnectionDataProvider = Static<typeof ConnectionDataProviderSchema>
