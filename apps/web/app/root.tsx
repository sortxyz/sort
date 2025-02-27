Object.hasOwn ??= (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

import { mergeHeaders } from "@sort/sdk";
import { Analytics } from "@vercel/analytics/react";
import { encrypt } from "@vercel/flags";
import { FlagDefinitions, FlagValues } from "@vercel/flags/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import type {
  HeadersFunction,
  LinkDescriptor,
  LoaderFunctionArgs,
  ShouldRevalidateFunctionArgs,
} from "react-router";
import {
  data,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useRouteLoaderData,
} from "react-router";
import { AuthenticityTokenProvider } from "remix-utils/csrf/react";
import appleTouchIconPrecomposedUrl from "~/assets/apple-touch-icon-precomposed.png?url";
import faviconUrl from "~/assets/favicon.svg?url";
import {
  DefaultGenericStatusHandler,
  GeneralErrorBoundary,
} from "~/components/general-error-boundary";
import { useNonce } from "~/components/nonce";
import { getOptionalUser } from "~/services/auth.server";
import hljsStylesheetUrl from "~/styles/hljs.css?url";
import tailwindStylesheetUrl from "~/styles/tailwind.css?url";
import { csrf } from "~/utils/csrf.server";
import { browserEnv, serverEnv } from "~/utils/env.server";
import { getFlash } from "~/utils/flash";
import { AnchorButton } from "./components/button";
import { Script } from "./components/script";
import { getFlagDefinitions, getFlags } from "./services/flags.server";

export const config = {
  maxDuration: 60,
};

export function links(): LinkDescriptor[] {
  return [
    {
      rel: "icon",
      href: faviconUrl,
      type: "image/svg+xml",
    },
    {
      rel: "apple-touch-icon-precomposed",
      href: appleTouchIconPrecomposedUrl,
    },
    { rel: "stylesheet", href: tailwindStylesheetUrl },
    { rel: "stylesheet", href: hljsStylesheetUrl },
  ];
}

export const headers: HeadersFunction = ({
  loaderHeaders,
  actionHeaders,
  errorHeaders,
  parentHeaders,
}) => {
  // Set cache-control for full-page loads
  const cacheControl =
    errorHeaders?.get("cache-control") ||
    loaderHeaders.get("cache-control") ||
    actionHeaders.get("cache-control") ||
    parentHeaders.get("cache-control") ||
    "no-store";

  return {
    "cache-control": cacheControl,
  };
};

export function shouldRevalidate({
  currentUrl,
  defaultShouldRevalidate,
  nextUrl,
}: ShouldRevalidateFunctionArgs) {
  if (currentUrl.toString() !== nextUrl.toString()) {
    return true;
  }
  return defaultShouldRevalidate;
}

export async function loader({ request }: LoaderFunctionArgs) {
  // home page is publicly cached so never display flash messages there.
  const isHomePage = request.url === "/";
  const { flash, headers } = isHomePage
    ? { flash: undefined, headers: undefined }
    : await getFlash(request);

  const [csrfToken, csrfCookieHeader] = await csrf.commitToken(request);

  // only the sortProfile is public session information
  const user = await getOptionalUser(request);
  const sortProfile = user?.sortProfile ?? null;

  return data(
    {
      definitions:
        serverEnv.SORT_HOSTED_THROUGH === "vercel" ? getFlagDefinitions() : {},
      values:
        serverEnv.SORT_HOSTED_THROUGH === "vercel"
          ? await encrypt(
              await getFlags(request),
              serverEnv.VERCEL_FLAGS_SECRET,
            )
          : {},
      flash,
      sortProfile,
      csrfToken,
      ENV: browserEnv,
    },
    {
      headers: mergeHeaders(
        headers,
        csrfCookieHeader
          ? {
              "Set-Cookie": csrfCookieHeader,
            }
          : undefined,
      ),
    },
  );
}

function App() {
  const loaderData = useLoaderData<typeof loader>();

  return (
    <AuthenticityTokenProvider token={loaderData.csrfToken}>
      <Outlet />
    </AuthenticityTokenProvider>
  );
}

export function ErrorBoundary() {
  return (
    <GeneralErrorBoundary
      statusHandlers={{
        404: ({ error, params }) => (
          <>
            <DefaultGenericStatusHandler error={error} params={params} />
            <p className="mt-4 mb-6 text-gray-600">
              We can&apos;t find that page.
            </p>
            <AnchorButton href="/">Return Home</AnchorButton>
          </>
        ),
      }}
    />
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const loaderData = useRouteLoaderData<typeof loader>("root");
  const nonce = useNonce();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `window.ENV = ${JSON.stringify(loaderData?.ENV ?? {})}`,
          }}
        />
      </head>
      <body>
        {children}
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
        {loaderData?.ENV.SORT_HOSTED_THROUGH === "vercel" ? (
          <>
            <Analytics />
            <SpeedInsights />
            <FlagDefinitions definitions={loaderData.definitions} />
            <FlagValues values={loaderData.values} />
          </>
        ) : undefined}
        {loaderData?.ENV.SORT_ANALYTICS === "posthog" ? (
          <Script src="/posthog.js" async defer nonce={nonce} />
        ) : undefined}
      </body>
    </html>
  );
}

export default App;
