import { mergeHeaders } from "@sort/sdk";
import { redirect } from "react-router";
import { getAuthenticator } from "~/services/auth.server";
import { returnToCookie } from "~/services/cookies.server";
import { commitSession, getSession } from "~/services/session.server";
import { isRedirect } from "~/utils/response";

export async function login(request: Request, type: "auth0" | "form") {
  const url = new URL(request.url);
  const authenticator = getAuthenticator(type, request);
  let caughtByAuthenticator = true;
  try {
    const user = await authenticator.authenticate(type, request);
    caughtByAuthenticator = false;

    const returnTo =
      ((await returnToCookie.parse(request.headers.get("Cookie"))) as
        | string
        | null) ?? "/my/orgs";
    const session = await getSession(request.headers.get("Cookie"));
    session.set("user", user);
    throw redirect(returnTo, {
      headers: mergeHeaders(
        {
          "Set-Cookie": await commitSession(session),
        },
        {
          "Set-Cookie": await returnToCookie.serialize("", {
            expires: new Date(0),
            maxAge: undefined,
          }),
        },
      ),
    });
  } catch (error) {
    if (!caughtByAuthenticator) {
      throw error;
    }

    const returnTo = url.searchParams.get("returnTo");
    if (!returnTo) {
      throw error;
    }

    if (error instanceof Response && isRedirect(error)) {
      error.headers.append(
        "Set-Cookie",
        await returnToCookie.serialize(returnTo),
      );
    }

    throw error;
  }
}
