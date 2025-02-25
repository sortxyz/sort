import { Type } from '@sinclair/typebox'

import type { Static, TSchema } from '@sinclair/typebox'

export type Nullable<T> = T | null

export const TNullable = <T extends TSchema>(schema: T) =>
  Type.Unsafe<Static<T> | null>({ ...schema, nullable: true })
