# @sort/logger

Logging helpers

## createLogger()

Creates a [pino][] logger set up with our base bindings.

```ts
import { createLogger } from '@sort/logger'

const logger = createLogger({
  LOG_LEVEL: 'info',
  APP_VERSION: '2fjkle9a0Eja9f323232jaskdfeEE'
})

logger.debug('hello world')
```

### logger.debug(..)

### logger.info(..)

### logger.warn(..)

### logger.error(error, msg)

This method no longer automatically sends errors to Sentry. Instead,
use the `notifySentry` method after logging the error.

### logger.child({ jobId: 'some-id-0123' })

Creates a child logger which inherits the bindings set up in the parent.

```ts
const c = logger.child({ jobId: 'some-id-0123' })
c.info('Hello')
```

See the [pino][] docs for more info.

## notifySentry()

Sends the error to Sentry.

```ts
import { notifySentry } from '@sort/logger'
notifySentry({
  error: new Error('bam'),
  message: 'something broke',
  contextId: 'some-job-id'
})
```


[pino]: https://getpino.io/

