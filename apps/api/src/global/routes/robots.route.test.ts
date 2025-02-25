import { getTestServer } from '../utils/test.util'

import type { FastifyInstance } from 'fastify'

describe('/robots.txt', () => {
  let server: FastifyInstance

  beforeAll(async () => {
    server = await getTestServer()
  })

  afterAll(async () => {
    await server.close()
  })

  it('should return 200', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/robots.txt'
    })

    expect(response.statusCode).toEqual(200)

    const body = response.body
    expect(body).toEqual('User-agent: *\nDisallow: /\nAllow: /docs/*')
  })
})
