import { Type } from '@sinclair/typebox'
import {
  UuidSchema,
  AuthHeadersSchema,
  GeneralErrorSchema,
  ValidationErrorSchema,
  createMessageSchema
} from '@sort/shared/schemas/api.schema'

import * as SearchService from '../services/search.service'

import type {
  FastifyReplyTypebox,
  FastifyRequestTypebox
} from '../types/fastify.type'
import type { FastifySchema } from 'fastify'

const QuerySchema = Type.Object({
  q: Type.String({ minLength: 1 }),
  limit: Type.Optional(Type.Integer({ maximum: 100 }))
})

const SearchResponseOrganizationSchema = Type.Object(
  {
    org_name: Type.String(),
    org_slug: Type.String()
  },
  {
    $id: 'SearchResponseOrganizationSchema'
  }
)

const SearchResponseDatabaseSchema = Type.Object(
  {
    db_name: Type.String(),
    db_name_raw: Type.String(),
    db_slug: Type.String(),
    org_name: Type.String(),
    org_slug: Type.String(),
    connection_id: UuidSchema,
    connection_name: Type.String()
  },
  {
    $id: 'SearchResponseDatabaseSchema'
  }
)

const SearchResponseTableSchema = Type.Object(
  {
    table_name: Type.String(),
    table_name_raw: Type.String(),
    schema_name: Type.String(),
    schema_name_raw: Type.String(),
    db_name: Type.String(),
    db_name_raw: Type.String(),
    db_slug: Type.String(),
    org_name: Type.String(),
    org_slug: Type.String(),
    connection_id: UuidSchema,
    connection_name: Type.String()
  },
  { $id: 'SearchResponseTableSchema' }
)

export const schemas = [
  SearchResponseOrganizationSchema,
  SearchResponseDatabaseSchema,
  SearchResponseTableSchema
]

export const searchSchema = {
  headers: AuthHeadersSchema,
  querystring: QuerySchema,
  operationId: 'search',
  tags: ['search'],
  summary: 'Search for Organizations, Databases, and Tables',
  response: {
    200: createMessageSchema(
      'search',
      Type.Object({
        results: Type.Object({
          organizations: Type.Array(
            Type.Ref<typeof SearchResponseOrganizationSchema>(
              SearchResponseOrganizationSchema
            )
          ),
          databases: Type.Array(
            Type.Ref<typeof SearchResponseDatabaseSchema>(
              SearchResponseDatabaseSchema
            )
          ),
          tables: Type.Array(
            Type.Ref<typeof SearchResponseTableSchema>(
              SearchResponseTableSchema
            )
          )
        })
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const search = async (
  request: FastifyRequestTypebox<typeof searchSchema>,
  reply: FastifyReplyTypebox<typeof searchSchema>
) => {
  const query = request.query.q
  const limit = request.query.limit ?? 5
  const results = await SearchService.search({
    query,
    limit,
    context: request.sort
  })

  return reply.status(200).send({
    type: 'search',
    payload: {
      results
    }
  })
}
