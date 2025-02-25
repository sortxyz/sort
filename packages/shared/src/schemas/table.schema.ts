import { Type } from '@sinclair/typebox'

import { UuidSchema } from './api.schema'
import { ColumnSchema } from './col.schema'

export const TableSchema = Type.Object({
  id: UuidSchema,
  name: Type.String(),
  columns: Type.Array(ColumnSchema)
})
