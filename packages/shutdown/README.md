# @sort/shutdown

This package hooks up all necessary listeners for shutting down your process
gracefully.

## Usage

```js
import { registerShutdown } from '@sort/shutdown'

registerShutdown({
  logger, // SortLogger
  cleanup: async () => {
    // clean up anything necessary before the process exits

    await server.close() // fastify
    await disconnectKysely() // etc
  }
})
```

## Events

When any of the following events are emitted on `process`, your `cleanup` method
is first executed before the process is exitted gracefully.

- `SIGINT`
- `SIGTERM`
- [`uncaughtException`](https://nodejs.org/api/process.html#event-uncaughtexception)
- [`unhandledRejection`](https://nodejs.org/api/process.html#event-unhandledrejection)
