import { Type } from '@sinclair/typebox'

import { UuidSchema } from './api.schema'
import { TableSchema } from './table.schema'

import type { Static } from '@sinclair/typebox'

export const FullSchemaSchema = Type.Object({
  id: UuidSchema,
  name: Type.String(),
  tables: Type.Array(TableSchema)
})

export type FullSchema = Static<typeof FullSchemaSchema>

/** @deprecated Use FullSchemaSchema instead */
export const FullSchemaSchemaOld = Type.Object({
  id: UuidSchema,
  name: Type.String(),
  tables: Type.Array(
    Type.Object({
      id: UuidSchema,
      name: Type.String(),
      columns: Type.Array(
        Type.Object({
          name: Type.String()
        })
      )
    })
  )
})

/** @deprecated Use FullSchemaSchema instead */
export type FullSchemaOld = Static<typeof FullSchemaSchemaOld>
