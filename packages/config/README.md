# @sort/config

This package is responsible for obtaining the configuration for a running
application. At start up, apps are expected to first import this module and
`configure()` themselves. For convenience, this package also exports a
`getConfig()` function which returns the latest configuration.

```ts
import { configure, getConfig } from '@sort/config'
```

## configure({ directory, schema, postEnvLoad? })

Returns a configuration object loaded from the environment.  This function is
based on `dotenv` so it will look for an appropriate .env file in the given
`directory`.

In addition to the env variables, the returned config object also contains the
following:

- `APP_VERSION` represents either the docker container id, the apps package.json version, or 'unknown' if neither is available.
- `ENV` represents the current environment (e.g. `development`, `test`, `production`).
- `IS_TEST_ENV` is a boolean indicating if the current environment is `test`.
- `IS_PROD_ENV` is a boolean indicating if the current environment is `production`.
- `LOG_LEVEL` is the log level to use. Defaults to `info`.

### Args

- `directory` The directory in which to look for the configuration file (`.env.{production,development,test}`).
- `schema` The `@sinclari/typebox` schema of the expected configuration object. This is used to validate the environment configuration.
- `postEnvLoad` An optional function which when provided is passed the parsed environment configuration object before it is validated against the given `schema`. This is commonly used to set custom properties, the values of which won't be known until the base environment configuration has been loaded. Example: set SORT_WEB_HOST to 'localhost' if env.SERVICE_URL is also 'localhost'.

```ts
import { configure } from '@sort/config'
import { Type } from '@sinclair/typebox'

const config = configure({ directory: __dirname, schema: Type.Object(..) })
console.log(config)
// {
//   WHATEVER_IS_IN_YOUR: '.env.production or .env.development or .env.test file',
//   APP_VERSION: 'e37eb1b466e1',
//   LOG_LEVEL: 'info',
//   IS_TEST_ENV: true,
//   IS_PROD_ENV: ...
// }
```

Using `postEnvLoad`

```ts
import { configure } from '@sort/config'
import { Type } from '@sinclair/typebox'

const postEnvLoad = (env: Record<string, unknown>) => {
  if (!env.SORT_WEB_HOST && env.IS_TEST_ENV) {
    env.SORT_WEB_HOST = 'http://localhost:3000'
  }
}
const config = configure({ directory: __dirname, schema: Type.Object(..), postEnvLoad })
console.log(config)
// {
//   WHATEVER_IS_IN_YOUR: '.env.production or .env.development or .env.test file',
//   APP_VERSION: 'e37eb1b466e1',
//   LOG_LEVEL: 'info',
//   IS_TEST_ENV: true,
//   SORT_WEB_HOST: 'http://localhost:3000'
//   IS_PROD_ENV: ...
// }
```

## getConfig()

Returns the last configuration populated by the `configure` function which must
be called first or an `Error` will be thrown.

```ts
import { getConfig } from '@sort/config'

const config = getConfig()
console.log(config)
// {
//   WHATEVER_IS_IN_YOUR: '.env.production or .env.development or .env.test file',
//   APP_VERSION: 'e37eb1b466e1',
//   LOG_LEVEL: 'info',
//   IS_TEST_ENV: true,
//   IS_PROD_ENV: ...
// }
```
