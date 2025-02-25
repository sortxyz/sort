import * as KyselyService from '../services/kysely.service'
import { getTestServer } from '../utils/test.util'

import type { FastifyInstance } from 'fastify'

describe('Tests for health check route', () => {
  let server: FastifyInstance

  beforeAll(async () => {
    server = await getTestServer()
    KyselyService.createKysely()
  })

  afterAll(async () => {
    await KyselyService.disconnectKysely()
    await server.close()
  })

  // integration tests with database
  it('Should respond with success when all dependencies are working', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/health'
    })

    expect(response.statusCode).toEqual(204)
  })
})
