import { Type } from '@sinclair/typebox'
import {
  AuthHeadersSchema,
  GeneralErrorSchema,
  ValidationErrorSchema,
  createMessageSchema
} from '@sort/shared/schemas/api.schema'

import {
  homePageDatabasesSchema,
  homePageQueriesSchema,
  getHomePageDatabases,
  getHomePageQueries
} from '../../services/home.service'

import type {
  FastifyReplyTypebox,
  FastifyRequestTypebox
} from '../../types/fastify.type'
import type { FastifySchema } from 'fastify'

export const getHomePageDataSchema = {
  headers: AuthHeadersSchema,
  operationId: 'get_home_page_data',
  response: {
    200: createMessageSchema(
      'get_home_page_data',
      Type.Object({
        databases: Type.Array(homePageDatabasesSchema),
        queries: Type.Array(homePageQueriesSchema)
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  },
  hide: true // hide the endpoint from openapi docs
} satisfies FastifySchema

export const getHomePageData = async (
  request: FastifyRequestTypebox<typeof getHomePageDataSchema>,
  reply: FastifyReplyTypebox<typeof getHomePageDataSchema>
) => {
  const [queries, databases] = await Promise.all([
    getHomePageQueries(),
    getHomePageDatabases()
  ])

  return reply
    .status(200)
    .header('cache-control', 'public s-maxage=3600 stale-while-revalidate=3600')
    .send({
      type: 'get_home_page_data',
      payload: {
        queries,
        databases
      }
    })
}
