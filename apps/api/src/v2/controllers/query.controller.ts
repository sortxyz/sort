import { Type } from '@sinclair/typebox'
import * as Errors from '@sort/shared/errors/index'
import { PublicFacingError } from '@sort/shared/errors/public-facing.error'
import {
  AuthHeadersSchema,
  GeneralErrorSchema,
  GeneralSuccessSchema,
  UuidSchema,
  ValidationErrorSchema,
  DateSchema,
  createMessageSchema,
  StringEnum
} from '@sort/shared/schemas/api.schema'
import { DatabaseSlugSchema } from '@sort/shared/schemas/metadata.schema'
import { OrganizationSlugSchema } from '@sort/shared/schemas/org.schema'
import * as QueryExecutionSchema from '@sort/shared/schemas/query-execution.schema'
import * as ConnectionService from '@sort/shared/services/connection.service'
import * as DatabaseService from '@sort/shared/services/kysely/metadata/database.service'
import * as OrganizationService from '@sort/shared/services/org.service'
import * as QueryStorageService from '@sort/shared/services/query/storage.service'
import { sendAnalyticsSlackNotification } from '@sort/shared/services/slack.service'
import { TNullable } from '@sort/shared/types/nullable.type'
import * as SharedUtils from '@sort/shared/utils/index'

import { config } from '../../config/bootstrap'
import { getDb } from '../../global/services/kysely.service'
import { createQueryExecutionService } from '../utils/query.util'

import type {
  FastifyReplyTypebox,
  FastifyRequestTypebox
} from '../types/fastify.type'
import type { DatabaseSelect } from '@sort/shared/types/kysely/metadata/database.type'
import type { FastifySchema } from 'fastify'

const { IS_PROD_ENV } = config

export const runQuerySchema = {
  headers: AuthHeadersSchema,
  summary: 'Run a Query',
  operationId: 'run_query',
  tags: ['query'],
  params: Type.Object({ org_slug: OrganizationSlugSchema }),
  body: Type.Object({
    query: QueryExecutionSchema.QuerySchema,
    database_slug: DatabaseSlugSchema
  }),
  response: {
    200: createMessageSchema(
      'run_query',
      Type.Object({
        result: QueryExecutionSchema.QueryExecutionResponseSchema
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    404: GeneralErrorSchema,
    422: GeneralErrorSchema,
    500: GeneralErrorSchema,
    504: GeneralErrorSchema
  }
} satisfies FastifySchema

export const run = async (
  request: FastifyRequestTypebox<typeof runQuerySchema>,
  reply: FastifyReplyTypebox<typeof runQuerySchema>
) => {
  const body = request.body
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
    dbSlug: body.database_slug
  })

  if (!connection || connection.organization_id !== org.id) {
    return reply.sendNotFound('connection')
  }

  if (
    connection.visibility === 'private' &&
    !org.permissions?.is_member.value
  ) {
    return reply.sendNotFound('database')
  }

  const database = await DatabaseService.getDbByOrgAndDbSlug({
    orgSlug: params.org_slug,
    dbSlug: body.database_slug
  })

  if (!database) {
    return reply.sendNotFound('database')
  }

  const querySvc = await createQueryExecutionService(
    connection,
    body.query.type
  )
  try {
    const result = await querySvc.execute(database.raw_name, body.query)

    // convert binary values to base64 strings
    const max = config.MAX_BINARY_STRING_LENGTH
    for (let colIndex = 0; colIndex < result.columns.length; colIndex++) {
      const col = result.columns[colIndex]
      if (col.type === 'binary') {
        for (let rowIndex = 0; rowIndex < result.records.length; rowIndex++) {
          const val = result.records[rowIndex][colIndex]
          if (Buffer.isBuffer(val)) {
            const str = val.toString()
            if (str.length > max) {
              result.records[rowIndex][colIndex] = `${str.slice(0, max)}...`
            } else {
              result.records[rowIndex][colIndex] = str
            }
          }
        }
      }
    }

    if (IS_PROD_ENV) {
      const sqlQuery =
        body.query.type === 'sql'
          ? body.query.sql
          : JSON.stringify(body.query.intent)
      void sendAnalyticsSlackNotification({
        message: `Query run by ${request.sort.user.name} in org ${org.name}`,
        initiatingUserEmail: request.sort.user.email,
        additionalMarkdown: `\`\`\`${sqlQuery}\`\`\``,
        logger: request.log
      })
    }

    return reply.status(200).send({
      type: 'run_query',
      payload: { result }
    })
  } catch (e) {
    if (e instanceof Errors.MissingReadonlyConnectionError) {
      return reply.status(422).send({
        type: 'error',
        payload: {
          error: {
            message: e.message
          }
        }
      })
    }

    if (e instanceof Errors.SqlSyntaxError) {
      request.log.info(e, 'non_select_operation_error')
      return reply.status(422).send({
        type: 'error',
        payload: {
          error: {
            message: e.message
          }
        }
      })
    }

    if (e instanceof Errors.MissingTableError) {
      return reply.sendNotFound('table')
    }

    if (e instanceof Errors.QueryTimeoutError) {
      return reply.status(504).send({
        type: 'error',
        payload: {
          error: {
            message:
              'Max query time exceeded. Tip: applying a LIMIT clause can reduce your overall query time.'
          }
        }
      })
    }

    if (e instanceof Errors.DatabaseConnectionTimeoutError) {
      return reply.status(504).send({
        type: 'error',
        payload: {
          error: {
            message:
              'The connection to your database timed out. Please try again soon.'
          }
        }
      })
    }

    if (e instanceof PublicFacingError) {
      return reply.status(422).send({
        type: 'error',
        payload: {
          error: {
            message: e.message
          }
        }
      })
    }

    if (!SharedUtils.isCapturableDatabaseError(e, connection.data_provider)) {
      throw e
    }

    const error = SharedUtils.getCapturableDatabaseError(
      e,
      connection.data_provider
    )

    request.log.info(error, 'data_provider_query_error')

    return reply.status(422).send({
      type: 'error',
      payload: {
        error: {
          message: `Something went wrong while executing your query.${
            error.helpfulProviderMessage
              ? ` \`${error.helpfulProviderMessage}.\``
              : ''
          }`
        }
      }
    })
  }
}

const ResponseQuerySchema = Type.Object(
  {
    id: UuidSchema,
    type: StringEnum(['sql', 'intent']),
    sql: TNullable(Type.String()),
    intent: TNullable(QueryExecutionSchema.IntentQuerySchema),
    connection_id: UuidSchema,
    name: TNullable(Type.String()),
    description: TNullable(Type.String()),
    database_name: Type.String(),
    database_slug: Type.String(),
    org_slug: OrganizationSlugSchema,
    created_by: Type.String(),
    created_by_name: TNullable(Type.String()),
    created_by_picture: TNullable(Type.String()),
    created_by_username: TNullable(Type.String()),
    created_at: DateSchema,
    updated_at: DateSchema
  },
  {
    $id: 'ResponseQuerySchema'
  }
)
const SingleQueryResponseSchema = Type.Object({
  query: Type.Ref<typeof ResponseQuerySchema>(ResponseQuerySchema)
})
const MultipleQueryResponseSchema = Type.Object({
  queries: Type.Array(Type.Ref<typeof ResponseQuerySchema>(ResponseQuerySchema))
})

const CreateQueryBodySchema = Type.Object({
  database_slug: DatabaseSlugSchema,
  query: QueryExecutionSchema.QuerySchema
})

export const CreateQuerySchema = {
  headers: AuthHeadersSchema,
  summary: 'Create a Query',
  operationId: 'create_query',
  tags: ['query'],
  params: Type.Object({ org_slug: OrganizationSlugSchema }),
  body: CreateQueryBodySchema,
  response: {
    201: createMessageSchema('create_query', SingleQueryResponseSchema),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    403: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const createQuery = async (
  request: FastifyRequestTypebox<typeof CreateQuerySchema>,
  reply: FastifyReplyTypebox<typeof CreateQuerySchema>
) => {
  const body = request.body
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
    dbSlug: body.database_slug
  })

  if (!connection || connection.organization_id !== org.id) {
    return reply.sendNotFound('database')
  }

  // we allow public members to save queries to public databases
  if (
    connection.visibility === 'private' &&
    !org.permissions?.is_member.value
  ) {
    return reply.status(403).send({
      type: 'error',
      payload: {
        error: { message: 'Only organization members can create queries.' }
      }
    })
  }

  const database = await DatabaseService.getDbByOrgAndDbSlug({
    orgSlug: params.org_slug,
    dbSlug: body.database_slug
  })

  if (!database) {
    return reply.sendNotFound('database')
  }

  const result = await QueryStorageService.insert({
    userId: request.sort.user.id,
    databaseName: database.raw_name,
    connectionId: connection.id,
    query: body.query
  })

  return reply.status(201).send({
    type: 'create_query',
    payload: {
      query: {
        ...result,
        database_slug: database.slug,
        org_slug: org.slug,
        created_by_name: request.sort.user.name ?? '',
        created_by_picture: request.sort.user.picture ?? null,
        created_by_username: request.sort.user.username ?? null
      }
    }
  })
}

export const GetQuerySchema = {
  headers: AuthHeadersSchema,
  summary: 'Get a Query',
  operationId: 'get_query',
  tags: ['query'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    query_id: UuidSchema
  }),
  response: {
    200: createMessageSchema('get_query', SingleQueryResponseSchema),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const getQuery = async (
  request: FastifyRequestTypebox<typeof GetQuerySchema>,
  reply: FastifyReplyTypebox<typeof GetQuerySchema>
) => {
  const params = request.params

  const org = await OrganizationService.getBySlug(
    params.org_slug,
    request.sort.user.id
  )

  if (!org) {
    return reply.sendNotFound('organization')
  }

  const result = await getDb()
    .selectFrom('query')
    .innerJoin('connection', 'query.connection_id', 'connection.id')
    .innerJoin('user', 'query.created_by', 'user.id')
    .innerJoin('metadata_database', join =>
      join
        .onRef('metadata_database.connection_id', '=', 'query.connection_id')
        .onRef('metadata_database.raw_name', '=', 'query.database_name')
    )
    .where('query.id', '=', params.query_id)
    .where('connection.organization_id', '=', org.id)
    .selectAll('query')
    .select('user.name as created_by_name')
    .select('user.picture as created_by_picture')
    .select('user.username as created_by_username')
    .select('connection.visibility')
    .select('metadata_database.slug as database_slug')
    .executeTakeFirst()

  if (!result) {
    return reply.sendNotFound('query')
  }

  if (result.visibility === 'private' && !org.permissions?.is_member.value) {
    return reply.sendNotFound('query')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { visibility, ...query } = result

  return reply.status(200).send({
    type: 'get_query',
    payload: {
      query: {
        ...query,
        org_slug: org.slug
      }
    }
  })
}

const UpdateQueryBodySchema = Type.Partial(
  Type.Object(
    {
      database_slug: DatabaseSlugSchema,
      query: Type.Union([
        QueryExecutionSchema.BaseQuerySchema,
        Type.Ref<typeof QueryExecutionSchema.RequestIntentQuerySchema>(
          QueryExecutionSchema.RequestIntentQuerySchema
        ),
        Type.Ref<typeof QueryExecutionSchema.RequestSqlQuerySchema>(
          QueryExecutionSchema.RequestSqlQuerySchema
        )
      ])
    },
    {
      minProperties: 1,
      additionalProperties: false
    }
  )
)

export const UpdateQuerySchema = {
  headers: AuthHeadersSchema,
  summary: 'Update a Query',
  operationId: 'update_query',
  tags: ['query'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    query_id: UuidSchema
  }),
  body: UpdateQueryBodySchema,
  response: {
    200: createMessageSchema('update_query', SingleQueryResponseSchema),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const updateQuery = async (
  request: FastifyRequestTypebox<typeof UpdateQuerySchema>,
  reply: FastifyReplyTypebox<typeof UpdateQuerySchema>
) => {
  const org = await OrganizationService.getBySlug(
    request.params.org_slug,
    request.sort.user.id
  )

  if (!org) {
    return reply.sendNotFound('organization')
  }

  if (!org.permissions?.is_member.value) {
    return reply.sendNotFound('query')
  }

  let databaseSlug: string | undefined
  let databaseName: string | undefined
  let connectionId: string | undefined
  if (request.body.database_slug) {
    const database = await DatabaseService.getDbByOrgAndDbSlug({
      orgSlug: request.params.org_slug,
      dbSlug: request.body.database_slug
    })

    if (!database) {
      return reply.sendNotFound('database')
    }

    databaseName = database.raw_name
    databaseSlug = database.slug
    connectionId = database.connection_id
  }

  const query = await QueryStorageService.update(
    {
      id: request.params.query_id,
      userId: request.sort.user.id,
      orgId: org.id
    },
    {
      databaseName,
      connectionId,
      query: request.body.query
    }
  )

  if (!query) {
    return reply.sendNotFound('query')
  }

  if (!databaseSlug) {
    const { slug } = await getDb()
      .selectFrom('metadata_database')
      .where('raw_name', '=', query.database_name)
      .where('connection_id', '=', query.connection_id)
      .select('slug')
      .executeTakeFirstOrThrow()
    databaseSlug = slug
  }

  return reply.status(200).send({
    type: 'update_query',
    payload: {
      query: {
        ...query,
        database_slug: databaseSlug,
        org_slug: org.slug,
        created_by_name: request.sort.user.name ?? '',
        created_by_picture: request.sort.user.picture ?? null,
        created_by_username: request.sort.user.username ?? ''
      }
    }
  })
}

export const DeleteQuerySchema = {
  headers: AuthHeadersSchema,
  summary: 'Delete a Query',
  operationId: 'delete_query',
  tags: ['query'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    query_id: UuidSchema
  }),
  response: {
    200: GeneralSuccessSchema,
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const deleteQuery = async (
  request: FastifyRequestTypebox<typeof DeleteQuerySchema>,
  reply: FastifyReplyTypebox<typeof DeleteQuerySchema>
) => {
  const params = request.params

  const org = await OrganizationService.getBySlug(
    params.org_slug,
    request.sort.user.id
  )

  if (!org) {
    return reply.sendNotFound('organization')
  }

  if (!org.permissions?.is_member.value) {
    return reply.sendNotFound('query')
  }

  const qb = getDb()
    .deleteFrom('query')
    .where('query.id', '=', params.query_id)
    .where('query.created_by', '=', request.sort.user.id)
    .where('query.connection_id', 'in', qb => {
      return qb
        .selectFrom('connection')
        .where('organization_id', '=', org.id)
        .select('id')
    })

  const result = await qb.executeTakeFirst()

  if (result.numDeletedRows === 0n) {
    return reply.sendNotFound('query')
  }

  return reply.send({
    type: 'success',
    payload: {
      success: {
        message: `Query ${params.query_id} deleted successfully.`
      }
    }
  })
}

export const ListQueriesSchema = {
  headers: AuthHeadersSchema,
  summary: 'Get all Queries of an Organization',
  operationId: 'list_queries',
  tags: ['query'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema
  }),
  querystring: Type.Object({
    database_slug: Type.Optional(DatabaseSlugSchema)
  }),
  response: {
    200: createMessageSchema('list_queries', MultipleQueryResponseSchema),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const listQueries = async (
  request: FastifyRequestTypebox<typeof ListQueriesSchema>,
  reply: FastifyReplyTypebox<typeof ListQueriesSchema>
) => {
  const params = request.params
  const qs = request.query

  const org = await OrganizationService.getBySlug(
    params.org_slug,
    request.sort.user.id
  )

  if (!org) {
    return reply.sendNotFound('organization')
  }

  let database: DatabaseSelect | undefined
  if (qs.database_slug) {
    database = await DatabaseService.getDbByOrgAndDbSlug({
      orgSlug: params.org_slug,
      dbSlug: qs.database_slug
    })

    if (!database) {
      return reply.sendNotFound('database')
    }
  }

  // TODO: paging https://github.com/sortxyz/sort-api-v2/issues/655
  let builder = getDb()
    .selectFrom('query')
    .innerJoin('connection', 'query.connection_id', 'connection.id')
    .innerJoin('user', 'query.created_by', 'user.id')
    .innerJoin('metadata_database', join =>
      join
        .onRef('metadata_database.connection_id', '=', 'query.connection_id')
        .onRef('metadata_database.raw_name', '=', 'query.database_name')
    )
    .where('connection.organization_id', '=', org.id)

  if (!org.permissions?.is_member.value) {
    builder = builder.where('connection.visibility', '=', 'public')
  }

  if (database) {
    builder = builder
      .where('query.database_name', '=', database.raw_name)
      .where('query.connection_id', '=', database.connection_id)
  }

  const queries = await builder
    .orderBy('query.name', 'asc')
    .selectAll('query')
    .select(['user.name as created_by_name'])
    .select(['user.picture as created_by_picture'])
    .select(['user.username as created_by_username'])
    .select('metadata_database.slug as database_slug')
    .execute()

  return reply.status(200).send({
    type: 'list_queries',
    payload: {
      queries: queries.map(query => ({
        ...query,
        org_slug: org.slug
      }))
    }
  })
}

export const schemas = [
  ResponseQuerySchema,
  QueryExecutionSchema.RequestIntentQuerySchema,
  QueryExecutionSchema.RequestSqlQuerySchema
]
