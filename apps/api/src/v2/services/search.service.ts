import { sql } from 'kysely'

import { getDb } from '../../global/services/kysely.service'

import type { SortContext } from '@sort/shared/types/sort-context.type'

type Scopes = Record<'db' | 'org' | 'schema', Lowercase<string>[]>

export const searchOrganizations = async ({
  phrase,
  limit,
  context,
  scopes
}: {
  phrase: string
  limit: number
  context: SortContext
  scopes: Scopes
}) => {
  if (!phrase.length && scopes.org.length === 0) {
    return []
  }

  let builder = getDb()
    .selectFrom('organization')
    .leftJoin('organization_user as ou', join => {
      return join
        .onRef('organization.id', '=', 'ou.organization_id')
        .on(
          'ou.user_id',
          '=',
          context.isCustomerAccount ? context.user.id : null
        )
    })
    .select([
      'organization.name as org_name',
      'organization.slug as org_slug',
      sql<number>`SIMILARITY(organization.name, ${phrase})`.as('likeness'),
      sql`NULLIF(ts_rank(to_tsvector(organization.name), websearch_to_tsquery(${phrase})), 0)`.as(
        'rank_name'
      )
    ])
    .orderBy('ou.user_id', 'asc') // personal data first
    .orderBy('rank_name')
    .orderBy('likeness', sql<string>`desc nulls last`)
    .limit(limit)

  if (phrase.length) {
    builder = builder.where(where => {
      return where.eb(
        where.fn('websearch_to_tsquery', [where.val(phrase)]),
        '@@',
        where.fn('to_tsvector', ['organization.name'])
      )
    })
  }

  if (scopes.org.length) {
    builder = builder.where(({ eb, fn }) => {
      return eb(fn('lower', ['organization.name']), 'in', scopes.org)
    })
  }

  try {
    return await builder.execute()
  } catch (err) {
    if (err instanceof Error && /invalid byte sequence/.test(err.message)) {
      return []
    }
    throw err
  }
}

export const withLatestSnapshotIds = (context: SortContext) => {
  const privateSnapshotsBuilder = sql`
    UNION ALL
    SELECT
      snapshot.connection_id,
      MAX(snapshot.timestamp) AS latest_timestamp
    FROM snapshot
    JOIN connection on snapshot.connection_id = connection.id
    JOIN organization_user on connection.organization_id = organization_user.organization_id
    WHERE
      organization_user.user_id = ${context.user.id}
      AND connection.visibility = 'private'
      AND snapshot.status = 'COMPLETED'
    GROUP BY snapshot.connection_id
  `

  const builder = sql<{ snapshot_id: string }>`WITH latest_snapshot_id AS (
    SELECT snapshot.id as snapshot_id
    FROM (
      SELECT
        snapshot.connection_id,
        MAX(snapshot.timestamp) AS latest_timestamp
      FROM snapshot
      JOIN connection ON snapshot.connection_id = connection.id
      WHERE
        connection.visibility = 'public' AND
        snapshot.status = 'COMPLETED'
      GROUP BY snapshot.connection_id
      ${context.isCustomerAccount ? privateSnapshotsBuilder : sql``}
    ) AS latest_snapshot_timestamp
    JOIN snapshot ON snapshot.connection_id = latest_snapshot_timestamp.connection_id
      AND snapshot.timestamp = latest_snapshot_timestamp.latest_timestamp
  )`

  return builder
}

export const searchDatabases = async ({
  phrase,
  limit,
  context,
  scopes
}: {
  phrase: string
  limit: number
  context: SortContext
  scopes: Scopes
}) => {
  const wherePhrase = phrase.length ? sql`AND query @@ document` : sql``

  const whereOrgScopes = scopes.org.length
    ? sql`AND LOWER(organization.name) IN (${sql.join(scopes.org)})`
    : sql``

  const whereDbScopes = scopes.db.length
    ? sql`AND LOWER(snapshot_database.name) IN (${sql.join(scopes.db)})`
    : sql``

  const whereSchemaScopes = scopes.schema.length
    ? sql`AND LOWER(snapshot_schema.name) IN (${sql.join(scopes.schema)})`
    : sql``

  const builder = sql<{
    org_name: string
    org_slug: string
    connection_id: string
    connection_name: string
    db_name: string
    db_name_raw: string
    db_slug: string
    likeness: number
    rank_name: number
  }>`${withLatestSnapshotIds(context)}
    SELECT
      connection.id AS connection_id,
      connection.name AS connection_name,
      snapshot_database.name AS db_name,
      snapshot_database.name AS db_name_raw,
      metadata_database.slug AS db_slug,
      organization.name AS org_name,
      organization.slug AS org_slug,
      likeness,
      NULLIF(ts_rank(to_tsvector(snapshot_database.name), query), 0) AS rank_name
    FROM
      snapshot_schema,
      snapshot_database,
      snapshot,
      connection,
      organization,
      metadata_database,
      to_tsvector(snapshot_database.name) AS document,
      websearch_to_tsquery(${phrase}) AS query,
      SIMILARITY(snapshot_database.name, ${phrase}) AS likeness
    WHERE
      snapshot_schema.database_id = snapshot_database.id
      AND snapshot_database.snapshot_id = snapshot.id
      AND snapshot.connection_id = connection.id
      AND connection.organization_id = organization.id
      AND snapshot.id in (SELECT snapshot_id FROM latest_snapshot_id)
      AND metadata_database.raw_name = snapshot_database.name
      AND metadata_database.connection_id = connection.id
      ${wherePhrase}
      ${whereOrgScopes}
      ${whereDbScopes}
      ${whereSchemaScopes}
    GROUP BY
      connection.id,
      connection.name,
      snapshot_database.name,
      metadata_database.slug,
      organization.name,
      organization.slug,
      likeness,
      rank_name
    ORDER BY connection.visibility ASC, rank_name, likeness DESC NULLS LAST
    LIMIT ${limit}
  `

  try {
    const result = await builder.execute(getDb())
    return result.rows
  } catch (err) {
    if (err instanceof Error && /invalid byte sequence/.test(err.message)) {
      return []
    }
    throw err
  }
}

export const searchTables = async ({
  phrase,
  limit,
  scopes,
  context
}: {
  phrase: string
  limit: number
  scopes: Scopes
  context: SortContext
}) => {
  const wherePhrase = phrase.length ? sql`AND query @@ document` : sql``

  const whereOrgScopes = scopes.org.length
    ? sql`AND LOWER(organization.name) IN (${sql.join(scopes.org)})`
    : sql``

  const whereDbScopes = scopes.db.length
    ? sql`AND LOWER(snapshot_database.name) IN (${sql.join(scopes.db)})`
    : sql``

  const whereSchemaScopes = scopes.schema.length
    ? sql`AND LOWER(snapshot_schema.name) IN (${sql.join(scopes.schema)})`
    : sql``

  const builder = sql<{
    org_name: string
    org_slug: string
    connection_id: string
    connection_name: string
    db_name: string
    db_name_raw: string
    db_slug: string
    schema_name: string
    schema_name_raw: string
    table_name: string
    table_name_raw: string
    likeness: number
    rank_name: number
  }>`${withLatestSnapshotIds(context)}
    SELECT
      organization.name AS org_name,
      organization.slug AS org_slug,
      connection.id AS connection_id,
      connection.name AS connection_name,
      snapshot_database.name AS db_name,
      snapshot_database.name AS db_name_raw,
      metadata_database.slug AS db_slug,
      snapshot_schema.name AS schema_name,
      snapshot_schema.name AS schema_name_raw,
      snapshot_table.name AS table_name,
      snapshot_table.name AS table_name_raw,
      likeness,
      NULLIF(ts_rank(to_tsvector(snapshot_table.name), query), 0) AS rank_name
    FROM
      snapshot_table,
      snapshot_schema,
      snapshot_database,
      snapshot,
      connection,
      organization,
      metadata_database,
      to_tsvector(snapshot_table.name) AS document,
      websearch_to_tsquery(${phrase}) AS query,
      SIMILARITY(snapshot_table.name, ${phrase}) AS likeness
    WHERE
      snapshot_table.schema_id = snapshot_schema.id
      AND snapshot_schema.database_id = snapshot_database.id
      AND snapshot_database.snapshot_id = snapshot.id
      AND snapshot.connection_id = connection.id
      AND connection.organization_id = organization.id
      AND snapshot.id in (SELECT snapshot_id FROM latest_snapshot_id)
      AND metadata_database.raw_name = snapshot_database.name
      AND metadata_database.connection_id = connection.id
      ${wherePhrase}
      ${whereOrgScopes}
      ${whereDbScopes}
      ${whereSchemaScopes}
    ORDER BY connection.visibility ASC, rank_name, likeness DESC NULLS LAST
    LIMIT ${limit}
  `

  try {
    const result = await builder.execute(getDb())
    return result.rows
  } catch (err) {
    if (err instanceof Error && /invalid byte sequence/.test(err.message)) {
      return []
    }
    throw err
  }
}

export const parseQuery = (query: string) => {
  const scopes: Scopes = {
    db: [],
    org: [],
    schema: []
  }

  // Extract quoted and unquoted query scopes like "schema:'my schema'" or
  // db:sort_xyz from the query.
  const queryTerms = query.replace(
    /(?<type>db|org|schema):((['"])(?<quoted>.*?)\3|(?<unquoted>[^\s]+))/gm,
    (...args) => {
      const { type, quoted, unquoted } = args[args.length - 1]
      if (Object.hasOwn(scopes, type)) {
        const value = quoted || unquoted
        if (value) {
          scopes[type as keyof Scopes].push(value.toLowerCase())
        }
      }
      return ''
    }
  )

  return {
    phrase: queryTerms.trim(),
    scopes
  }
}

export const search = async ({
  query,
  limit,
  context
}: {
  query: string
  limit: number
  context: SortContext
}) => {
  // TODO Add metadata search to search results

  const { phrase, scopes } = parseQuery(query)

  const organizations = await searchOrganizations({
    phrase,
    limit,
    scopes,
    context
  })

  const [databases, tables] = await Promise.all([
    searchDatabases({
      phrase,
      limit,
      scopes,
      context
    }),
    searchTables({
      phrase,
      limit,
      scopes,
      context
    })
  ])

  return {
    organizations,
    databases,
    tables
  }
}
