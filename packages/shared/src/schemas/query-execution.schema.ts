import { Type } from '@sinclair/typebox'

import { MAX_QUERY_LIMIT } from '../constants/database.constant'
import { TNullable } from '../types/nullable.type'

import {
  DiscriminatedUnion,
  StringEnum,
  MarkdownColumnSchema
} from './api.schema'
import { ResponseColumnTypesSchema } from './response-column.schema'

import type { Static } from '@sinclair/typebox'

export const DMLSchema = StringEnum(['SELECT'])

export const CombinatorSchema = StringEnum(
  ['AND', 'OR'],
  'How the filters are combined in the query.'
)

export const OpSchema = StringEnum(['=', '!=', '>', '<', '>=', '<='])

export const DirectionSchema = StringEnum(['ASC', 'DESC'])

export const IntentQuerySchema = Type.Object({
  dml: DMLSchema,
  schema: Type.String(),
  table: Type.String(),
  columns: Type.Array(Type.String(), {
    maxItems: 300,
    description: 'The column names to select. Use `*` to include all columns.'
  }),
  filters: Type.Array(
    Type.Object({
      column: Type.String(),
      op: OpSchema,
      value: Type.String()
    }),
    { maxItems: 75 }
  ),
  combinator: CombinatorSchema,
  orders: Type.Array(
    Type.Object({
      column: Type.String(),
      direction: DirectionSchema
    }),
    { maxItems: 25 }
  ),
  limit: Type.Number({
    minimum: 1,
    maximum: MAX_QUERY_LIMIT,
    description: 'Default is 100'
  })
})
export type IntentQuery = Static<typeof IntentQuerySchema>

export const BaseQuerySchema = Type.Object({
  description: Type.Optional(MarkdownColumnSchema),
  name: Type.Optional(TNullable(Type.String({ minLength: 1, maxLength: 128 })))
})
export type BaseQuery = Static<typeof BaseQuerySchema>

export const RequestIntentQuerySchema = Type.Composite(
  [
    BaseQuerySchema,
    Type.Object({
      type: Type.Literal('intent'),
      intent: IntentQuerySchema
    })
  ],
  { $id: 'RequestIntentQuerySchema' }
)
export type RequestIntentQuery = Static<typeof RequestIntentQuerySchema>
export const RequestSqlQuerySchema = Type.Composite(
  [
    BaseQuerySchema,
    Type.Object({
      type: Type.Literal('sql'),
      sql: Type.String({
        minLength: 5,
        maxLength: 20000,
        description: 'SQL text. Only reads are supported.',
        examples: ['SELECT * FROM public.table']
      })
    })
  ],
  { $id: 'RequestSqlQuerySchema' }
)
export type RequestSqlQuery = Static<typeof RequestSqlQuerySchema>

// spec: https://www.notion.so/sortxyz/Queries-3437554f9c0b422f92ffcccb2eb9b57c#20be8cf89a5d4d5893d3d1b0dcf218f4
export const QuerySchema = DiscriminatedUnion('type', [
  Type.Ref<typeof RequestIntentQuerySchema>(RequestIntentQuerySchema),
  Type.Ref<typeof RequestSqlQuerySchema>(RequestSqlQuerySchema)
])
export type Query = Static<typeof QuerySchema>

// This schema maps data provider query responses directly to our http response
// without comparing to our imported schemas - So there's no `is_primary_key` or
// `nullable` fields like in ColumnSchema.
export const QueryColumnSchema = Type.Object({
  type: Type.Union([ResponseColumnTypesSchema, Type.Literal('unknown')]),
  name: Type.String()
})

export type QueryColumn = Static<typeof QueryColumnSchema>

export const QueryExecutionResponseSchema = Type.Object({
  duration_ms: Type.Number(),
  query: Type.String(),
  records: Type.Array(Type.Array(Type.Unknown())),
  columns: Type.Array(QueryColumnSchema)
})

export type QueryExecutionResponse = Static<typeof QueryExecutionResponseSchema>

export const QueryRecordSchema = Type.Array(
  Type.Union([Type.String(), Type.Number(), Type.Boolean()])
)

export type QueryRecord = Static<typeof QueryRecordSchema>
