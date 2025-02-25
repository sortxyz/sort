import { Type } from '@sinclair/typebox'

import type { Static } from '@sinclair/typebox'

export const QueryValidationSchema = Type.Object({
  query: Type.String(),
  database: Type.String(),
  // this means that the query is a SELECT statement that can be fired through our platform
  is_sort_queryable: Type.Boolean(),
  error: Type.Optional(Type.String())
})

export type QueryValidation = Static<typeof QueryValidationSchema>
