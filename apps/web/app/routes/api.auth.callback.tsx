import type { LoaderFunctionArgs } from "react-router";
import { redirectDocument } from "react-router";
import { getAuthenticator } from "~/services/auth.server";
import { returnToCookie } from "~/services/cookies.server";
import { sessionKey, sessionStorage } from "~/services/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const authenticator = getAuthenticator("auth0", request);
  const user = await authenticator.authenticate("auth0", request);

  if (!user) {
    throw redirectDocument("/?failure=auth");
  }

  const returnTo =
    ((await returnToCookie.parse(request.headers.get("cookie"))) as
      | string
      | null) ?? "/my/orgs";

  const session = await sessionStorage.getSession(
    request.headers.get("cookie"),
  );
  session.set(sessionKey, user);

  const headers = new Headers();
  headers.append("Set-Cookie", await sessionStorage.commitSession(session));
  headers.append(
    "Set-Cookie",
    await returnToCookie.serialize("", {
      expires: new Date(0),
      maxAge: undefined,
    }),
  );

  throw redirectDocument(returnTo, {
    headers,
  });
}
