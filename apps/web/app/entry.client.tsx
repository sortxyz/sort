/**
 * This file is mostly generated from the `remix reveal entry.client` command.
 * However, it's been modified to include Sentry's BrowserTracing integration.
 */

import { HydratedRouter } from "react-router/dom";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { Telemetry } from "./services/telemetry";
import type { BrowserEnv } from "./utils/env.server";

declare global {
  interface Window {
    ENV: BrowserEnv;
  }
}

Telemetry.init(window.ENV);

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>,
  );
});
