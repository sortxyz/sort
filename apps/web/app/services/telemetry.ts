import * as Sentry from "@sentry/react";
import type { BrowserEnv } from "~/utils/env.server";

export class Telemetry {
  static init(env: BrowserEnv) {
    switch (env.SORT_TELEMETRY) {
      case "sentry": {
        Sentry.init({
          enabled: true,
          dsn: env.SENTRY_DSN,
          integrations: [
            Sentry.browserTracingIntegration(),
            Sentry.replayIntegration(),
          ],
          tracesSampleRate: 0.1,
          tracePropagationTargets: [
            "localhost",
            /^https:\/\/sortweb.*\.vercel\.app/,
            /^https:\/\/.*\.sort.xyz/,
          ],
          replaysSessionSampleRate: 0.1,
          replaysOnErrorSampleRate: 1.0,
          environment: env.SENTRY_ENV,
          beforeSend(event, hint) {
            if (hint.originalException instanceof Error) {
              const error = hint.originalException;
              if (error.stack?.includes("/_next-live/feedback/")) {
                return null;
              }
            }

            return event;
          },
        });
      }
    }
  }
}
