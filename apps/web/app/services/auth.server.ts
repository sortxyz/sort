import { randomUUID } from "node:crypto";
import { redirect } from "react-router";
import { Authenticator } from "remix-auth";
import { FormStrategy } from "remix-auth-form";
import { client } from "~/sdk/client.server";
import { serverEnv } from "~/utils/env.server";
import { assert } from "~/utils/error";
import { createOnPremAuthJwt, verifyAuth0JWT } from "~/utils/jwt.server";
import { users } from "../../users";
import { Auth0Strategy } from "./auth0-strategy.server";
import type { SessionData } from "./session.server";
import { sessionKey, sessionStorage } from "./session.server";

function getRedirectURI(callbackURL: string, request: Request) {
  const host =
    request.headers.get("X-Forwarded-Host") ??
    request.headers.get("host") ??
    new URL(request.url).host;

  const protocol = host.includes("localhost") ? "http" : "https";

  if (callbackURL.startsWith("/")) {
    return new URL(callbackURL, `${protocol}://${host}`);
  }

  return new URL(`${protocol}//${callbackURL}`);
}

function getAuth0Strategy(request: Request) {
  assert(serverEnv.SORT_AUTH === "auth0", 'AUTH is not set to "auth0"');
  const redirectURI = getRedirectURI("/api/auth/callback", request).toString();

  return new Auth0Strategy<SessionData["user"]>(
    {
      redirectURI,
      clientId: serverEnv.AUTH0_CLIENT_ID,
      clientSecret: serverEnv.AUTH0_CLIENT_SECRET,
      domain: new URL(serverEnv.AUTH0_ISSUER_BASE_URL).hostname,
    },
    async ({ tokens }) => {
      const idToken = tokens.idToken();

      const response = await client.v2.initializeUser({
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to authenticate with Sort API");
      }

      const message = await response.json();

      if (!message.payload.jwt) {
        throw new Error(
          "Failed to authenticate. Sort API did not return a JWT",
        );
      }

      const jwt = await verifyAuth0JWT(idToken);

      return {
        sortProfile: message.payload.profile,
        sortJWT: message.payload.jwt,
        auth_time: jwt.auth_time,
      } satisfies SessionData["user"];
    },
  );
}

function getFormStrategy() {
  assert(serverEnv.SORT_AUTH === "form", 'AUTH is not set to "form"');
  return new FormStrategy(async ({ form }) => {
    const email = form.get("email");
    const password = form.get("password");
    if (typeof email !== "string" || typeof password !== "string") {
      throw new Error("Invalid email or password");
    }
    if (users[email] !== password) {
      throw new Error("Invalid email or password");
    }

    // Generate a JWT with the email in it. Pass it to the API. The API will
    // check to ensure its running in on-prem mode, then validate the JWT,
    // initialize the user and respond with a SortJWT.
    const onPremJWT = await createOnPremAuthJwt(email);

    const response = await client.v2.initializeOnPremUser({
      headers: {
        Authorization: `Bearer ${onPremJWT}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to authenticate with Sort API");
    }

    const message = await response.json();

    if (!message.payload.jwt) {
      throw new Error("Failed to authenticate. Sort API did not return a JWT");
    }

    const authTime = new Date().getTime() / 1000;

    return {
      sortProfile: message.payload.profile,
      sortJWT: message.payload.jwt,
      auth_time: authTime,
    } satisfies SessionData["user"];
  });
}

export function getAuthenticator(type: "auth0" | "form", request: Request) {
  switch (type) {
    case "auth0":
      return new Authenticator<SessionData["user"]>().use(
        getAuth0Strategy(request),
        type,
      );
    case "form":
      return new Authenticator<SessionData["user"]>().use(
        getFormStrategy(),
        type,
      );
  }
}

export async function getRequiredUser(request: Request) {
  const url = new URL(request.url);
  const returnTo = url.pathname + url.search;

  const user = await getOptionalUser(request);

  if (!user) {
    throw redirect(`/api/auth/login?${new URLSearchParams({ returnTo })}`);
  }

  return user;
}

export function getDefaultRequestHeaders(request: Request) {
  const vercelRequestId = request.headers.get("x-vercel-id");
  const requestId = vercelRequestId?.replace(/^[\w:]+::/, "") || randomUUID();

  const headers: {
    "x-sort-forwarded-for"?: string;
    "request-id": string;
  } = {
    "request-id": requestId,
  };

  const ips = request.headers.get("x-forwarded-for");
  if (ips) {
    // Vercel overwrites outgoing "x-forwarded-for" headers so use a custom one
    // to pass along the client IP.
    headers["x-sort-forwarded-for"] = ips;
  }

  return new Headers(headers);
}

export async function getRequiredUserHeaders(request: Request) {
  const user = await getRequiredUser(request);

  return new Headers({
    Authorization: `Bearer ${user.sortJWT}`,
  });
}

export async function getOptionalUser(request: Request) {
  const session = await sessionStorage.getSession(
    request.headers.get("cookie"),
  );

  return session.get(sessionKey);
}

export async function getOptionalUserHeaders(request: Request) {
  const user = await getOptionalUser(request);

  if (!user?.sortJWT) {
    return undefined;
  }

  return new Headers({
    Authorization: `Bearer ${user.sortJWT}`,
  });
}

export function getServiceAccountHeaders() {
  return new Headers({
    "x-api-key": serverEnv.SORT_SERVICE_ACCOUNT_API_KEY,
  });
}

export async function getUserOrServiceAccountHeaders(request: Request) {
  const optionalHeaders = await getOptionalUserHeaders(request);

  if (!optionalHeaders) {
    return getServiceAccountHeaders();
  }

  return optionalHeaders;
}
