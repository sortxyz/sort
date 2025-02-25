import { Type } from '@sinclair/typebox'

import { TNullable } from '../types/nullable.type'

import {
  UuidSchema,
  MarkdownColumnSchema,
  UriSchema,
  createSlugSchema
} from './api.schema'
import { OrganizationSlugSchema } from './org.schema'

import type { Static } from '@sinclair/typebox'

export const DatabaseSlugSchema = createSlugSchema('The database slug')

export const DatabaseMetadataSchema = Type.Object({
  connection_id: UuidSchema,
  organization_id: UuidSchema,
  organization_slug: OrganizationSlugSchema,
  raw_name: Type.String(),
  display_name: TNullable(Type.String()),
  slug: DatabaseSlugSchema,
  summary: TNullable(Type.String()),
  description: MarkdownColumnSchema,
  link: UriSchema
})

export type DatabaseMetadata = Static<typeof DatabaseMetadataSchema>
