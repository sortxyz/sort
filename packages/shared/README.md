# @sort/shared

The module through which our apps will connect to our PostgreSQL database.

```ts
import { createKysely, disconnectKysely } from '@sort/shared'
import { getConfig } from '@sort/config'
import { createLogger } from '@sort/logger'

const config = getConfig()
const logger = createLogger(config)
const db = createKysely({ config, logger })

// ..

const rows = await db
  .selectFrom('default_label')
  .orderBy('name')
  .select(['name'])
  .executeTakeFirst()

await disconnectKysely()
```

## `createKysely()`

## `disconnectKysely()`

## `db`

For convenience, this module exports a `db` value which is set to the result of
the latest `createKysely()` execution.

```ts
// my-app-file.ts
import { db } from '@sort/shared'

db.selectFrom(..).execute()
```

## Generating types from our Postgres database

`pnpm db:codegen`

## Generating Postgres error codes

`pnpm db:gen-postgres-errors`

# Install

Run `pnpm install`

# Test

Run `pnpm test`
