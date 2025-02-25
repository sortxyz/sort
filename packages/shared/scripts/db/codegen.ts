import { execSync } from 'node:child_process'
import * as path from 'node:path'
import { Type } from '@sinclair/typebox'

import { configure } from '@sort/config'
import { toDbParams } from '../../src/utils/kysely.util'

const directory = path.resolve(process.cwd(), '..', '..', 'apps', 'api')
const schema = Type.Object({
  POSTGRES_DB: Type.Optional(Type.String()),
  POSTGRES_HOST: Type.Optional(Type.String()),
  POSTGRES_USER: Type.Optional(Type.String()),
  POSTGRES_PASSWORD: Type.Optional(Type.String()),
})

const config = configure({
  directory,
  schema
})
const { host, port, user, password, database } = toDbParams(config)

const DATABASE_URL = `postgres://${user}:${password}@${host}:${port}/${database}`

const outFile = path.resolve(
  process.cwd(),
  'src',
  'types',
  '__generated',
  'kysely.type.ts'
)

// eslint-disable-next-line no-console
console.log('generating database models in %s...', outFile)

execSync(`kysely-codegen --out-file "${outFile}" --url "${DATABASE_URL}"`)

// eslint-disable-next-line no-console
console.log('database model generation done!')
