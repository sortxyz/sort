import { Type } from '@sinclair/typebox'
import * as Errors from '@sort/shared/errors/index'
import {
  AuthHeadersSchema,
  GeneralErrorSchema,
  ValidationErrorSchema,
  createMessageSchema,
  UuidSchema,
  StringEnum
} from '@sort/shared/schemas/api.schema'
import { ColumnSchema } from '@sort/shared/schemas/col.schema'
import { ConnectionResponseSchema } from '@sort/shared/schemas/connection.schema'
import {
  DatabaseSlugSchema,
  DatabaseMetadataSchema
} from '@sort/shared/schemas/metadata.schema'
import { OrganizationSlugSchema } from '@sort/shared/schemas/org.schema'
import * as ConnectionService from '@sort/shared/services/connection.service'
import * as DatabaseMetadataService from '@sort/shared/services/kysely/metadata/database.service'
import { getDatabaseBySlug } from '@sort/shared/services/kysely/snapshot/database.service'
import {
  getFullSchema,
  getSchemaByName
} from '@sort/shared/services/kysely/snapshot/schema.service'
import * as SnapshotService from '@sort/shared/services/kysely/snapshot/snapshot.service'
import { getTableByName } from '@sort/shared/services/kysely/snapshot/table.service'
import * as OrganizationService from '@sort/shared/services/org.service'
import * as SharedUtils from '@sort/shared/utils/index'

import { getDb } from '../../global/services/kysely.service'

import type {
  FastifyReplyTypebox,
  FastifyRequestTypebox
} from '../types/fastify.type'
import type { Static } from '@sinclair/typebox'
import type { FastifySchema } from 'fastify'

export const GetDatabase = {
  headers: AuthHeadersSchema,
  summary: 'Get a database',
  operationId: 'get_database',
  tags: ['database'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema
  }),
  response: {
    200: createMessageSchema(
      'get_database',
      Type.Object({
        database: DatabaseMetadataSchema
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const getDatabase = async (
  request: FastifyRequestTypebox<typeof GetDatabase>,
  reply: FastifyReplyTypebox<typeof GetDatabase>
) => {
  const params = request.params

  const org = await OrganizationService.getBySlug(
    params.org_slug,
    request.sort.user.id
  )

  if (!org) {
    return reply.sendNotFound('organization')
  }

  const database = await DatabaseMetadataService.getDbByOrgAndDbSlug({
    orgSlug: params.org_slug,
    dbSlug: params.db_slug
  })

  if (!database) {
    return reply.sendNotFound('database')
  }

  const connection = await ConnectionService.getById(database.connection_id)
  if (!connection) {
    return reply.sendNotFound('database')
  }

  if (connection.visibility === 'private') {
    if (!org.permissions?.is_member.value) {
      return reply.sendNotFound('database')
    }
  }

  return reply.status(200).send({
    type: 'get_database',
    payload: {
      database: {
        ...database,
        organization_slug: org.slug,
        summary: database.summary ?? '',
        display_name: database.display_name ?? '',
        description: database.description ?? ''
      }
    }
  })
}

const UpdateDatabaseBodySchema = Type.Partial(
  Type.Pick(DatabaseMetadataSchema, [
    'slug',
    'display_name',
    'summary',
    'description',
    'link'
  ]),
  { minProperties: 1, additionalProperties: false }
)

export const UpdateDatabaseSchema = {
  headers: AuthHeadersSchema,
  summary: 'Update database details',
  operationId: 'update_database',
  tags: ['database'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema
  }),
  body: UpdateDatabaseBodySchema,
  response: {
    200: createMessageSchema(
      'update_database',
      Type.Object({
        database: DatabaseMetadataSchema
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    403: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const updateDatabase = async (
  request: FastifyRequestTypebox<typeof UpdateDatabaseSchema>,
  reply: FastifyReplyTypebox<typeof UpdateDatabaseSchema>
) => {
  const org = await OrganizationService.getBySlug(
    request.params.org_slug,
    request.sort.user.id
  )

  if (!org) {
    return reply.sendNotFound('organization')
  }

  if (!org.permissions?.is_member.value) {
    return reply.sendNotFound('database')
  }

  const isOwner = org.permissions?.is_owner.value === true
  request.log.info({ isOwner })
  if (!isOwner) {
    return reply.status(403).send({
      type: 'error',
      payload: {
        error: { message: 'Only organization owners can update databases.' }
      }
    })
  }

  const updates: typeof request.body = {}
  if (request.body.slug?.trim()) {
    updates.slug = request.body.slug?.trim()
  }
  if (Object.hasOwn(request.body, 'display_name')) {
    updates.display_name = request.body.display_name
  }
  if (Object.hasOwn(request.body, 'summary')) {
    updates.summary = request.body.summary
  }
  if (Object.hasOwn(request.body, 'description')) {
    updates.description = request.body.description
  }
  if (Object.hasOwn(request.body, 'link')) {
    updates.link = request.body.link
  }

  try {
    const database = await getDb()
      .updateTable('metadata_database')
      .where('slug', '=', request.params.db_slug)
      .where('organization_id', '=', org.id)
      .set(updates)
      .returningAll()
      .executeTakeFirst()

    if (!database) {
      return reply.sendNotFound('database')
    }

    return reply.status(200).send({
      type: 'update_database',
      payload: {
        database: {
          ...database,
          organization_slug: org.slug
        }
      }
    })
  } catch (error) {
    if (!Errors.DatabaseUniquenessError.isViolationError(error)) {
      throw error
    }

    const err = new Errors.DatabaseUniquenessError(error)

    if (err.constraint !== 'metadata_database_pkey') {
      throw error
    }

    return reply.status(409).send({
      type: 'error',
      payload: {
        error: { message: 'Database slug already taken.' }
      }
    })
  }
}

const GetDatabaseSchemasResponseSchema = Type.Array(
  Type.Object({
    id: UuidSchema,
    name: Type.String(),
    tables: Type.Optional(
      Type.Array(
        Type.Object({
          id: UuidSchema,
          name: Type.String(),
          columns: Type.Optional(Type.Array(ColumnSchema))
        })
      )
    )
  })
)
type GetDatabaseSchemasResponseSchema = Static<
  typeof GetDatabaseSchemasResponseSchema
>

export const getDatabaseSchemasSchema = {
  headers: AuthHeadersSchema,
  summary: 'Get the database schemas, optionally including tables and columns',
  operationId: 'list_database_schemas',
  tags: ['database'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema
  }),
  querystring: Type.Object({
    include: Type.Optional(StringEnum(['tables', 'columns']))
  }),
  response: {
    200: createMessageSchema(
      'list_database_schemas',
      Type.Object({
        schemas: GetDatabaseSchemasResponseSchema
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    404: GeneralErrorSchema,
    409: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const getDatabaseSchemas = async (
  request: FastifyRequestTypebox<typeof getDatabaseSchemasSchema>,
  reply: FastifyReplyTypebox<typeof getDatabaseSchemasSchema>
) => {
  const params = request.params

  const org = await OrganizationService.getBySlug(
    params.org_slug,
    request.sort.user.id
  )

  if (!org) {
    return reply.sendNotFound('organization')
  }

  const connection = await ConnectionService.getByOrgAndDbSlug({
    orgSlug: params.org_slug,
    dbSlug: params.db_slug
  })

  if (!connection) {
    return reply.sendNotFound('database')
  }

  if (
    connection.visibility === 'private' &&
    !org.permissions?.is_member.value
  ) {
    return reply.sendNotFound('database')
  }

  const currentSnapshot = await SnapshotService.getCurrentSnapshot(
    connection.id
  )
  if (!currentSnapshot) {
    return reply.sendNotFound('completed snapshot')
  }

  const database = await getDatabaseBySlug({
    snapshotId: currentSnapshot.id,
    dbSlug: params.db_slug
  })
  if (!database) {
    return reply.sendNotFound('database')
  }

  // There is an optimization waiting for us here: passing the `include` value
  // to the schema service so we can fetch less data from the database. However,
  // the tradeoff comes at increased complexity in both code and types. For the
  // prototype, fetching all the data and removing what we don't need is good
  // enough. Besides, this query can return the entire opendental db in 2ms.
  const fullSchema = await getFullSchema({
    connection,
    databaseId: database.id
  })

  const schemas = ((): GetDatabaseSchemasResponseSchema => {
    switch (request.query.include) {
      case 'columns':
        return fullSchema
      case 'tables': {
        return fullSchema.map(schema => {
          return {
            ...schema,
            tables: schema.tables.map(table => {
              const { columns: _remove, ...rest } = table
              return rest
            })
          }
        })
      }
      default: {
        return fullSchema.map(schema => {
          const { tables: _remove, ...rest } = schema
          return rest
        })
      }
    }
  })()

  return reply.status(200).send({
    type: 'list_database_schemas',
    payload: {
      schemas
    }
  })
}

const GetSchemaTablesResponseSchema = Type.Array(
  Type.Object({
    id: UuidSchema,
    name: Type.String(),
    columns: Type.Optional(Type.Array(ColumnSchema))
  })
)

type GetSchemaTablesResponseSchema = Static<
  typeof GetSchemaTablesResponseSchema
>

export const getSchemaTablesSchema = {
  headers: AuthHeadersSchema,
  summary: 'Get all tables of a database schema, optionally including columns',
  operationId: 'list_schema_tables',
  tags: ['database'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema,
    schema_name: Type.String()
  }),
  querystring: Type.Object({
    include: Type.Optional(Type.Literal('columns'))
  }),
  response: {
    200: createMessageSchema(
      'list_schema_tables',
      Type.Object({
        tables: GetSchemaTablesResponseSchema
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    404: GeneralErrorSchema,
    409: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const getSchemaTables = async (
  request: FastifyRequestTypebox<typeof getSchemaTablesSchema>,
  reply: FastifyReplyTypebox<typeof getSchemaTablesSchema>
) => {
  const params = request.params

  const org = await OrganizationService.getBySlug(
    params.org_slug,
    request.sort.user.id
  )

  if (!org) {
    return reply.sendNotFound('organization')
  }

  const connection = await ConnectionService.getByOrgAndDbSlug({
    orgSlug: params.org_slug,
    dbSlug: params.db_slug
  })
  if (!connection) {
    return reply.sendNotFound('database')
  }

  if (
    connection.visibility === 'private' &&
    !org.permissions?.is_member.value
  ) {
    return reply.sendNotFound('database')
  }

  const currentSnapshot = await SnapshotService.getCurrentSnapshot(
    connection.id
  )
  if (!currentSnapshot) {
    return reply.sendNotFound('completed snapshot')
  }

  const database = await getDatabaseBySlug({
    snapshotId: currentSnapshot.id,
    dbSlug: request.params.db_slug
  })
  if (!database) {
    return reply.sendNotFound('database')
  }

  // There is an optimization waiting for us here: passing the `include` value
  // to the schema service so we can fetch less data from the database. However,
  // the tradeoff comes at increased complexity in both code and types. For the
  // prototype, fetching all the data and removing what we don't need is good
  // enough. Besides, this query can return the entire opendental db in 2ms.
  const fullSchemas = await getFullSchema({
    connection,
    databaseId: database.id,
    schemaName: params.schema_name
  })

  const schema = fullSchemas[0]
  if (!schema) {
    return reply.sendNotFound('schema')
  }

  const tables =
    request.query.include === 'columns'
      ? schema.tables
      : schema.tables.map(table => {
          const { columns: _remove, ...rest } = table
          return rest
        })

  return reply.status(200).send({
    type: 'list_schema_tables',
    payload: {
      tables
    }
  })
}

export const getTableColumnsSchema = {
  headers: AuthHeadersSchema,
  summary: 'Get all columns of a table',
  operationId: 'list_table_columns',
  tags: ['database'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema,
    schema_name: Type.String(),
    table_name: Type.String()
  }),
  response: {
    200: createMessageSchema(
      'list_table_columns',
      Type.Object({
        columns: Type.Array(ColumnSchema)
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    404: GeneralErrorSchema,
    409: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const getTableColumns = async (
  request: FastifyRequestTypebox<typeof getTableColumnsSchema>,
  reply: FastifyReplyTypebox<typeof getTableColumnsSchema>
) => {
  const params = request.params

  const org = await OrganizationService.getBySlug(
    params.org_slug,
    request.sort.user.id
  )

  if (!org) {
    return reply.sendNotFound('organization')
  }

  const connection = await ConnectionService.getByOrgAndDbSlug({
    orgSlug: params.org_slug,
    dbSlug: params.db_slug
  })
  if (!connection) {
    return reply.sendNotFound('database')
  }

  if (
    connection.visibility === 'private' &&
    !org.permissions?.is_member.value
  ) {
    return reply.sendNotFound('database')
  }

  const currentSnapshot = await SnapshotService.getCurrentSnapshot(
    connection.id
  )
  if (!currentSnapshot) {
    return reply.sendNotFound('completed snapshot')
  }

  const database = await getDatabaseBySlug({
    snapshotId: currentSnapshot.id,
    dbSlug: request.params.db_slug
  })
  if (!database) {
    return reply.sendNotFound('database')
  }

  {
    const schema = await getSchemaByName(database.id, params.schema_name)
    if (!schema) {
      return reply.sendNotFound('schema')
    }

    if (!(await getTableByName(schema.id, params.table_name))) {
      return reply.sendNotFound('table')
    }
  }

  const schemas = await getFullSchema({
    connection,
    databaseId: database.id,
    schemaName: params.schema_name,
    tableName: params.table_name
  })
  const schema = schemas[0]
  if (!schema) {
    return reply.sendNotFound('schema')
  }

  const table = schema.tables[0]
  if (!table) {
    return reply.sendNotFound('table')
  }

  return reply.status(200).send({
    type: 'list_table_columns',
    payload: {
      columns: table.columns
    }
  })
}

export const GetDatabaseConnectionSchema = {
  headers: AuthHeadersSchema,
  summary: 'Get the Connection of a database',
  operationId: 'get_database_connection',
  tags: ['database', 'connection'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema
  }),
  response: {
    200: createMessageSchema(
      'get_database_connection',
      Type.Object({
        connection: ConnectionResponseSchema
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const getDatabaseConnection = async (
  request: FastifyRequestTypebox<typeof GetDatabaseConnectionSchema>,
  reply: FastifyReplyTypebox<typeof GetDatabaseConnectionSchema>
) => {
  const params = request.params

  const org = await OrganizationService.getBySlug(
    params.org_slug,
    request.sort.user.id
  )

  if (!org) {
    return reply.sendNotFound('organization')
  }

  const database = await DatabaseMetadataService.getDbByOrgAndDbSlug({
    orgSlug: params.org_slug,
    dbSlug: params.db_slug
  })

  if (!database) {
    return reply.sendNotFound('database')
  }

  const connection = await ConnectionService.getById(database.connection_id)
  if (!connection) {
    return reply.sendNotFound('database')
  }

  if (connection.visibility === 'private') {
    if (!org.permissions?.is_member.value) {
      return reply.sendNotFound('database')
    }
  }

  return reply.status(200).send({
    type: 'get_database_connection',
    payload: {
      connection: SharedUtils.sanitizeConnectionForResponse(connection)
    }
  })
}
