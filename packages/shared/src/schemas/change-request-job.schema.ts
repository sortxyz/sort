import { Type } from '@sinclair/typebox'

import { TNullable } from '../types/nullable.type'

import { DateSchema, UuidSchema } from './api.schema'

import type { Static } from '@sinclair/typebox'

export const ChangeRequestJobSchema = Type.Object({
  id: UuidSchema,
  change_request_id: UuidSchema,
  status: Type.String(),
  start_time: TNullable(DateSchema),
  end_time: TNullable(DateSchema),
  error_message: TNullable(Type.String()),
  rows_affected: TNullable(Type.Number()),
  created_at: DateSchema,
  updated_at: DateSchema
})

export type ChangeRequestJob = Static<typeof ChangeRequestJobSchema>
