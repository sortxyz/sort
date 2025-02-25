import * as SearchController from '../controllers/search.controller'
import { checkAuthentication, addSchemas } from '../utils/route.util'

import type { FastifyInstance } from 'fastify'

export const register = (server: FastifyInstance) => {
  addSchemas(server, [SearchController])

  server.get(
    '/v2/search',
    {
      schema: SearchController.searchSchema,
      onRequest: checkAuthentication('isAccount')
    },
    SearchController.search
  )
}
