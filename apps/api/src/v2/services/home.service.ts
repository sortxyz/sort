import { Type } from '@sinclair/typebox'
import { DateSchema, UuidSchema } from '@sort/shared/schemas/api.schema'
import { ConnectionDataProviderSchema } from '@sort/shared/schemas/data-provider.schema'
import { sql } from 'kysely'

import { config } from '../../config/bootstrap'
import { getDb } from '../../global/services/kysely.service'

import type { Static } from '@sinclair/typebox'

const { HOME_ROUTE_MAX_RESULTS } = config

export const homePageDatabasesSchema = Type.Object({
  db_real_name: Type.String(),
  db_summary: Type.String(),
  db_slug: Type.String(),
  db_display_name: Type.String(),
  connection_id: UuidSchema,
  data_provider: ConnectionDataProviderSchema,
  org_slug: Type.String(),
  updated_at: DateSchema
})

/**
 * Retreive the public databases with most recently updated queries.
 */
export const getHomePageDatabases = async () => {
  const result = await sql<
    Static<typeof homePageDatabasesSchema>
  >`WITH latest AS (
      SELECT
        q.database_name,
        q.connection_id,
        c.data_provider,
        c.organization_id,
        max(q.updated_at) AS updated_at
      FROM public.query q
      JOIN public.connection c ON q.connection_id = c.id
      WHERE c.visibility = 'public'
      GROUP BY q.database_name, q.connection_id, c.data_provider, c.organization_id
      ORDER BY updated_at DESC
      LIMIT ${HOME_ROUTE_MAX_RESULTS}
    )
    SELECT
      md.raw_name AS db_real_name,
      md.summary AS db_summary,
      md.slug AS db_slug,
      md.display_name AS db_display_name,
      latest.connection_id,
      latest.data_provider,
      o.slug AS org_slug,
      latest.updated_at
    FROM latest
    JOIN public.metadata_database md
      ON md.connection_id = latest.connection_id
      AND md.raw_name = latest.database_name
    JOIN public.organization o ON o.id = latest.organization_id
    ORDER BY latest.updated_at DESC
  `.execute(getDb())

  return result.rows
}

export const homePageQueriesSchema = Type.Object({
  query_id: Type.String(),
  query_name: Type.String(),
  query_description: Type.String(),
  query_schema: Type.String(),
  connection_id: UuidSchema,
  connection_data_provider: ConnectionDataProviderSchema,
  org_slug: Type.String(),
  db_real_name: Type.String(),
  db_slug: Type.String(),
  db_display_name: Type.String(),
  updated_at: DateSchema
})

/**
 * Retreive the most recently updated public queries.
 */
export const getHomePageQueries = async () => {
  const result = await sql<Static<typeof homePageQueriesSchema>>`SELECT
      q.id AS query_id,
      q.name AS query_name,
      q.description AS query_description,
      q.intent->>'schema' as query_schema,
      q.updated_at,
      c.id as connection_id,
      c.data_provider as connection_data_provider,
      o.slug AS org_slug,
      md.raw_name AS db_real_name,
      md.slug AS db_slug,
      md.display_name AS db_display_name
    FROM public.query q
    JOIN public.connection c ON q.connection_id  = c.id
    JOIN public.organization o ON c.organization_id = o.id
    JOIN public.metadata_database md ON md.connection_id = c.id and md.raw_name = q.database_name
    WHERE c.visibility = 'public'
    ORDER BY updated_at DESC
    LIMIT ${HOME_ROUTE_MAX_RESULTS}
  `.execute(getDb())

  return result.rows
}
