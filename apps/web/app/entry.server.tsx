/**
 * This file is mostly generated from the `remix reveal entry.server` command.
 * However, it's been modified to include Sentry's NodeTracing integration
 * as well as the Content Security Policy (CSP) headers and nonce generation.
 */

import { randomBytes } from "node:crypto";
import { PassThrough } from "node:stream";
import { Telemetry } from "./services/telemetry.server";
import { serverEnv } from "./utils/env.server";

import { createReadableStreamFromReadable } from "@react-router/node";
import { isbot } from "isbot";
import type {
  RenderToPipeableStreamOptions,
  RenderToReadableStreamOptions,
} from "react-dom/server";
import { renderToPipeableStream } from "react-dom/server";
import type { AppLoadContext, EntryContext } from "react-router";
import { ServerRouter } from "react-router";
import { NonceContext } from "./components/nonce";

export const streamTimeout = 5_000;

export type RenderOptions = {
  [K in keyof RenderToReadableStreamOptions &
    keyof RenderToPipeableStreamOptions]?: RenderToReadableStreamOptions[K];
};

function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext?: AppLoadContext,
  options?: RenderOptions,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    const userAgent = request.headers.get("user-agent");

    // Ensure requests from bots and SPA Mode renders wait for all content to load before responding
    // https://react.dev/reference/react-dom/server/renderToPipeableStream#waiting-for-all-content-to-load-for-crawlers-and-static-generation
    const readyOption: keyof RenderToPipeableStreamOptions =
      (userAgent && isbot(userAgent)) || routerContext.isSpaMode
        ? "onAllReady"
        : "onShellReady";

    const { pipe, abort } = renderToPipeableStream(
      <NonceContext.Provider value={options?.nonce ?? ""}>
        <ServerRouter
          context={routerContext}
          url={request.url}
          nonce={options?.nonce}
        />
      </NonceContext.Provider>,

      {
        ...options,

        [readyOption]() {
          shellRendered = true;
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);

          responseHeaders.set("Content-Type", "text/html");

          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          );

          pipe(body);
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          responseStatusCode = 500;
          // Log streaming rendering errors from inside the shell.  Don't log
          // errors encountered during initial shell rendering since they'll
          // reject and get logged in handleDocumentRequest.
          if (shellRendered) {
            console.error(error);
          }
        },
      },
    );

    // Abort the rendering stream after the `streamTimeout` so it has time to
    // flush down the rejected boundaries
    setTimeout(abort, streamTimeout + 1000);
  });
}

Telemetry.init();

const NULL_CSP = {};

type CspName =
  | "base-uri"
  | "child-src"
  | "connect-src"
  | "default-src"
  | "font-src"
  | "form-action"
  | "frame-ancestors"
  | "frame-src"
  | "img-src"
  | "media-src"
  | "object-src"
  | "report-uri"
  | "script-src"
  | "style-src"
  | "worker-src";

type Csp = { [key in CspName]?: string[] };

const BASE_CSP = {
  "base-uri": ["'none'"],
  "child-src": ["'self'"],
  "connect-src": ["'self'"],
  "default-src": ["'none'"],
  "font-src": ["'self'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'none'"],
  "frame-src": [],
  "img-src": ["'self'", "https:"],
  "media-src": ["'self'"],
  "object-src": ["'none'"],
  "report-uri": [],
  "script-src": ["'self'"],
  "style-src": ["'self'", "'unsafe-inline'"],
  "worker-src": ["'self'"],
} satisfies Required<Csp>;

const AUTH0_CSP =
  serverEnv.SORT_AUTH === "auth0"
    ? {
        "form-action": [serverEnv.AUTH0_ISSUER_BASE_URL],
      }
    : (NULL_CSP satisfies Csp);

const DEVELOPMENT_CSP = {
  "connect-src": ["ws://localhost:3001"],
} satisfies Csp;

const VERCEL_PREVIEW_CSP = {
  "connect-src": [
    "https://vercel.live",
    "wss://ws-us3.pusher.com",
    "https://sockjs-us3.pusher.com",
  ],
  "font-src": ["https://vercel.live"],
  "frame-src": ["https://vercel.live"],
  "img-src": ["data:"],
  "script-src": ["'unsafe-inline'", "https://vercel.live"],
  "style-src": ["'unsafe-inline'", "https://vercel.live"],
} satisfies Csp;

const VERCEL_DEVELOPMENT_CSP = {
  "script-src": ["https://va.vercel-scripts.com"],
};

const VERCEL_CSP =
  serverEnv.SORT_HOSTED_THROUGH === "vercel"
    ? mergeCSP(
        {
          "connect-src": [
            "https://vitals.vercel-analytics.com",
            "https://vercel.live",
          ],
          "frame-src": ["https://vercel.live"],
          "script-src": ["https://vercel.live"],
        },
        serverEnv.VERCEL_ENV === "preview" ? VERCEL_PREVIEW_CSP : NULL_CSP,
        serverEnv.VERCEL_ENV === "development"
          ? VERCEL_DEVELOPMENT_CSP
          : NULL_CSP,
      )
    : NULL_CSP;

const SENTRY_CSP = {
  "connect-src": [
    "https://o4504877972914176.ingest.sentry.io",
    "https://o4504877972914176.ingest.us.sentry.io",
  ],
  "report-uri": [
    "https://o4504877972914176.ingest.sentry.io/api/4505807075082240/security/?sentry_key=c0616799513c73556dd91edb55c1dc67",
  ],
  "child-src": ["blob:"],
  "worker-src": ["blob:"],
  "script-src": ["blob:", "https://o4504877972914176.ingest.sentry.io"],
} satisfies Csp;

const POSTHOG_CSP = {
  "connect-src": ["https://*.posthog.com"],
  "script-src": ["https://*.posthog.com"],
} satisfies Csp;

function mergeCSP(...csps: Csp[]) {
  const merged: Csp = {};
  for (const csp of csps) {
    for (const [key, values] of Object.entries(csp) as [CspName, string[]][]) {
      merged[key] ??= [];
      merged[key] = Array.from(new Set(merged[key]?.concat(values)));
    }
  }
  return merged;
}

const STATIC_CSP = mergeCSP(
  BASE_CSP,
  serverEnv.NODE_ENV === "development" ? DEVELOPMENT_CSP : NULL_CSP,
  serverEnv.SORT_AUTH === "auth0" ? AUTH0_CSP : NULL_CSP,
  serverEnv.SORT_HOSTED_THROUGH === "vercel" ? VERCEL_CSP : NULL_CSP,
  serverEnv.SORT_TELEMETRY === "sentry" ? SENTRY_CSP : NULL_CSP,
  serverEnv.SORT_ANALYTICS === "posthog" ? POSTHOG_CSP : NULL_CSP,
);

function getCSPHeader(nonce: string) {
  return Object.entries(
    mergeCSP(
      STATIC_CSP,
      serverEnv.SORT_HOSTED_THROUGH === "vercel" &&
        serverEnv.VERCEL_ENV === "preview"
        ? NULL_CSP
        : ({ "script-src": [`'nonce-${nonce}'`] } satisfies Csp),
    ),
  )
    .map(([key, value]) => `${key} ${value.join(" ")}`)
    .join(";");
}

function getHeaders(nonce: string) {
  return {
    "Content-Security-Policy": getCSPHeader(nonce),
    "Strict-Transport-Security": "max-age=63072000;",
    "X-XSS-Protection": "1; mode=block",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "SAMEORIGIN",
    "X-Robots-Tag": "noindex, nofollow",
    "Permissions-Policy":
      "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  };
}

export const handleError = Telemetry.handleError;

export function handleDataRequest(response: Response) {
  // Set cache-control for data fetches caused by browser navigations
  const cacheControl = response.headers.get("cache-control") || "no-store";
  response.headers.set("cache-control", cacheControl);
  return response;
}

export default function (
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  loadContext?: AppLoadContext,
) {
  const nonce = randomBytes(16).toString("hex");
  for (const [key, value] of Object.entries(getHeaders(nonce))) {
    responseHeaders.set(key, value);
  }

  return handleRequest(
    request,
    responseStatusCode,
    responseHeaders,
    routerContext,
    loadContext,
    { nonce },
  );
}
