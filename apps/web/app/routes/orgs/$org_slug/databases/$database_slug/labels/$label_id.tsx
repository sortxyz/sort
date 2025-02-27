import { mergeHeaders } from "@sort/sdk";
import type { LoaderFunctionArgs, UIMatch } from "react-router";
import { BreadcrumbNavLink } from "~/components/breadcrumb-nav";
import { client } from "~/sdk/client.server";
import {
  getDefaultRequestHeaders,
  getUserOrServiceAccountHeaders,
} from "~/services/auth.server";
import { dataFnMiddleware } from "~/utils/request.server";
import { assertResponseParams, extractMessageOrThrow } from "~/utils/response";

export async function loader({ request, params }: LoaderFunctionArgs) {
  assertResponseParams(params, ["org_slug", "database_slug", "label_id"]);

  const headers = mergeHeaders(
    getDefaultRequestHeaders(request),
    await getUserOrServiceAccountHeaders(request),
  );

  const {
    payload: { label },
  } = await dataFnMiddleware(
    request,
    client.v2.getDatabaseLabel({
      headers,
      params,
    }),
  ).then(extractMessageOrThrow("get_database_label"));

  return { label };
}

export const handle = {
  breadcrumb(match: UIMatch<Awaited<ReturnType<typeof loader>>>) {
    return (
      <BreadcrumbNavLink end to={match.pathname}>
        {match.data?.label?.name ?? "Label"}
      </BreadcrumbNavLink>
    );
  },
};
