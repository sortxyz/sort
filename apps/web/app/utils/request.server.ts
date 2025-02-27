import type { TypedResponse } from "@sort/sdk";
import { redirect, redirectDocument } from "react-router";
import { client } from "~/sdk/client.server";
import { getRequiredUser } from "~/services/auth.server";
import { returnToCookie } from "~/services/cookies.server";
import { destroySession, getSession } from "~/services/session.server";
import { serverEnv } from "./env.server";
import { getAbsoluteURL } from "./url";

export async function dataFnMiddleware<T>(
  request: Request,
  responsePromise: Promise<TypedResponse<T>>,
) {
  const response = await responsePromise;

  if (response.status === 401) {
    const session = await getSession(request.headers.get("Cookie"));

    const url = new URL(request.url);
    const returnToafterLogin = url.pathname + url.search;

    const headers = new Headers();
    headers.append("Set-Cookie", await destroySession(session));
    headers.append(
      "Set-Cookie",
      await returnToCookie.serialize(returnToafterLogin),
    );

    const logoutURL = (() => {
      switch (serverEnv.SORT_AUTH) {
        case "auth0": {
          const url = new URL("/v2/logout", serverEnv.AUTH0_ISSUER_BASE_URL);
          url.searchParams.set("client_id", serverEnv.AUTH0_CLIENT_ID);
          url.searchParams.set(
            "returnTo",
            getAbsoluteURL(request, "/api/auth/login"),
          );
          return url;
        }
        case "form": {
          return getAbsoluteURL(request, "/login");
        }
        default: {
          throw new Error("Unsupported auth type");
        }
      }
    })();

    throw redirect(logoutURL.toString(), {
      headers,
    });
  }

  if (!response.headers.get("Content-Type")?.includes("application/json")) {
    throw response;
  }

  return response;
}
export async function logout(request: Request) {
  const session = await getSession(request.headers.get("Cookie"));

  let logoutURL = getAbsoluteURL(request, "/");

  switch (serverEnv.SORT_AUTH) {
    case "auth0": {
      const url = new URL("/v2/logout", serverEnv.AUTH0_ISSUER_BASE_URL);
      url.searchParams.set("client_id", serverEnv.AUTH0_CLIENT_ID);
      url.searchParams.set("returnTo", getAbsoluteURL(request, "/"));
      logoutURL = String(url);
    }
  }

  const { sortProfile } = await getRequiredUser(request);
  await client.v2.revokeSessions({
    body: {
      user_id: sortProfile.id,
      secret: serverEnv.SORT_SESSION_REVOKE_SECRET,
    },
  });

  const headers = new Headers();
  headers.append("Set-Cookie", await destroySession(session));
  headers.append(
    "Set-Cookie",
    `csrf=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT${
      serverEnv.NODE_ENV === "production" ? "; Secure" : ""
    }`,
  );
  headers.append(
    "Set-Cookie",
    await returnToCookie.serialize("", {
      expires: new Date(0),
      maxAge: undefined,
    }),
  );

  throw redirectDocument(logoutURL.toString(), {
    headers,
  });
}
