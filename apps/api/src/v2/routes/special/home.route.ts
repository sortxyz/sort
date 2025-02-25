import * as HomeController from '../../controllers/special/home.controller'
import { checkAuthentication } from '../../utils/route.util'

import type { FastifyInstance } from 'fastify'

export const register = (server: FastifyInstance) => {
  server.get(
    '/v2/special/home',
    {
      schema: HomeController.getHomePageDataSchema,
      onRequest: checkAuthentication('isPublicAccount')
    },
    HomeController.getHomePageData
  )
}
