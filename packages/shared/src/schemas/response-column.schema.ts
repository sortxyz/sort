import { Type } from '@sinclair/typebox'

import type { Static } from '@sinclair/typebox'

export const ResponseColumnTypesArray = [
  'numeric',
  'string',
  'boolean',
  'date',
  'uuid',
  'json',
  'binary'
] as const

export const ResponseColumnTypesSchema = Type.Union(
  ResponseColumnTypesArray.map(n => Type.Literal(n))
)

export type ResponseColumnTypes = Static<typeof ResponseColumnTypesSchema>
export type DataProviderColumnMapping = {
  [key in ResponseColumnTypes]: string[]
}
