/**
 * This middleware executes in Vercels Edge Network, acting as a proxy between
 * the client and our application.
 *
 * This middleware serves two purposes:
 *
 * 1) Serves maintenance page when appropriate
 * 2) Proxies requests to our webflow marketing pages
 *
 * If we are not in maintenance mode and the request is not for a webflow
 * page, the request is passed through to SortWeb.
 *
 * ## Maintenance Mode
 *
 * To enable maintenance mode, set the environment variable SORT_WEB_MAINTENANCE_ENABLED=1
 *
 * ## Webflow Pages
 *
 * Webflow pages are served from the Webflow domain. To update the content of a
 * Webflow page, make the changes directly in Webflow.
 *
 * WARNING: When linking to Webflow urls in application code we MUST use the
 * native anchor html element instead of a react component like <Link/> or the
 * application behaves _very badly_. For example:
 *
 * BAD: <Link to="/platforms/postgres">Postgres</Link>
 * GOOD: <a href="/platforms/postgres">Postgres</a>
 **/

const SORT_WEB_MAINTENANCE_ENABLED =
  process.env.SORT_WEB_MAINTENANCE_ENABLED === "1";

// Run this middleware before all sort.xyz routes except for those starting with:
export const config = {
  matcher: [
    "/((?!maintenance|public/|assets/|_vercel/|.well-known/|api/auth/).*)",
  ],
};

/**
 * These pages get proxied to Webflow.
 */
export const webflowPages = [
  "/",
  "/platforms/postgres",
  "/platforms/snowflake",
  "/pricing",
  "/solutions/community-managers",
  "/solutions/customer-support",
  "/solutions/data-teams",
  "/solutions/internal-operations",
  "/use-cases/ai-and-llms",
  "/use-cases/centralized-data-platform",
  "/use-cases/customer-support-internal-operations",
  "/use-cases/data-change-management",
  "/use-cases/data-discovery",
  "/use-cases/data-issue-management",
  "/use-cases/data-quality",
];

export default async function middleware(request: Request) {
  const url = new URL(request.url);

  if (webflowPages.includes(url.pathname)) {
    url.host = "webflow.sort.xyz";
    const res = await fetch(url.toString(), {
      referrer: request.referrer,
    });

    if (!res.headers.get("x-content-type-options")) {
      res.headers.set("x-content-type-options", "nosniff");
    }
    if (!res.headers.get("Referrer-Policy")) {
      res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    }
    if (!res.headers.get("Permissions-Policy")) {
      res.headers.set(
        "Permissions-Policy",
        "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
      );
    }

    return res;
  }

  if (SORT_WEB_MAINTENANCE_ENABLED) {
    console.log("SORT_WEB_MAINTENANCE_ENABLED enabled");
    return Response.redirect(new URL("/maintenance", request.url));
  }

  const headers = new Headers(request.headers ?? {});
  headers.set("x-middleware-next", "1");
  return new Response(null, { ...request, headers });
}
