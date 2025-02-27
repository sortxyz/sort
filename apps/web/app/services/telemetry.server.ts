import * as Sentry from "@sentry/node";
import type { HandleErrorFunction } from "react-router";
import { serverEnv } from "~/utils/env.server";

export class Telemetry {
  static init() {
    switch (serverEnv.SORT_TELEMETRY) {
      case "sentry": {
        Sentry.init({
          enabled: true,
          dsn: serverEnv.SENTRY_DSN,
          // Set tracesSampleRate to 1.0 to capture 100%
          // of transactions for tracing.
          // We recommend adjusting this value in production
          tracesSampleRate: 0.1,
          // To capture action formData attributes.
          sendDefaultPii: serverEnv.NODE_ENV === "development",
          environment: serverEnv.SENTRY_ENV,
        });
      }
    }
  }

  static handleError: HandleErrorFunction = (error, args) => {
    switch (serverEnv.SORT_TELEMETRY) {
      case "sentry": {
        if (!args.request.signal.aborted) {
          return Sentry.captureException(error);
        }
        return;
      }
      default: {
        return console.error(error, args);
      }
    }
  };
}
