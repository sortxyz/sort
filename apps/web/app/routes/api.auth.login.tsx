import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirectDocument } from "react-router";
import { getOptionalUser } from "~/services/auth.server";
import { login } from "~/services/login.server";
import { serverEnv } from "~/utils/env.server";

async function handleOnPrem(request: Request) {
  const url = new URL(request.url);
  const forceLogin = url.searchParams.get("prompt") === "login";

  if (!forceLogin && (await getOptionalUser(request))) {
    return redirectDocument("/my/orgs");
  }

  url.pathname = "/login";
  return redirectDocument(url.toString());
}

export async function action({ request }: ActionFunctionArgs) {
  if (serverEnv.SORT_AUTH === "auth0") {
    return await login(request, serverEnv.SORT_AUTH);
  }

  return await handleOnPrem(request);
}
export async function loader({ request }: LoaderFunctionArgs) {
  if (serverEnv.SORT_AUTH === "auth0") {
    return await login(request, serverEnv.SORT_AUTH);
  }

  return await handleOnPrem(request);
}
