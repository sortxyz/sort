/* eslint-disable no-console */
process.env.NODE_ENV = 'test'

import { writeFileSync, mkdirSync } from 'node:fs'
import * as path from 'node:path'

import { createServer } from '../global/utils/server.util'

const filePath = path.resolve('openapi', process.argv[2] ?? 'spec.json')

const writeSpec = async () => {
  const server = await createServer()

  const response = await server.inject({
    method: 'GET',
    url: '/docs/json'
  })

  if (response.statusCode !== 200) {
    console.error(response.body)
    throw new Error('Failed to get openapi docs')
  }

  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, response.body)

  // eslint-disable-next-line no-console
  console.log(`OpenAPI spec written to ${filePath}`)

  await server.close()
}

writeSpec().catch(err => {
  console.error(err)
  process.exit(1)
})
