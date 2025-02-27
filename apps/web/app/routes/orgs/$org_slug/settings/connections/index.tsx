import { mergeHeaders } from "@sort/sdk";
import { IconPlugConnected, IconPlus } from "@tabler/icons-react";
import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData, useParams } from "react-router";
import { Article } from "~/components/article";
import { LinkButton } from "~/components/button";
import { VisibilityTag } from "~/components/visibility-tag";
import { client } from "~/sdk/client.server";
import {
  getDefaultRequestHeaders,
  getRequiredUserHeaders,
} from "~/services/auth.server";
import { dataFnMiddleware } from "~/utils/request.server";
import { assertResponseParams, extractMessageOrThrow } from "~/utils/response";

export async function loader({ request, params }: LoaderFunctionArgs) {
  assertResponseParams(params, ["org_slug"]);
  const headers = mergeHeaders(
    getDefaultRequestHeaders(request),
    await getRequiredUserHeaders(request),
  );
  const {
    payload: { connections },
  } = await dataFnMiddleware(
    request,
    client.v2.listConnections({
      headers,
      params,
    }),
  ).then(extractMessageOrThrow("list_connections"));

  const childConnections = new Set<string>();
  for (const conn of connections) {
    if (conn.readonly_connection_id) {
      childConnections.add(conn.readonly_connection_id);
    }
  }

  const parentConnections = connections.filter(
    (c) => !childConnections.has(c.id),
  );

  return { connections: parentConnections };
}

export default function Route() {
  const loaderData = useLoaderData<typeof loader>();
  const params = useParams();

  return (
    <Article>
      <header className="flex items-start justify-between">
        <h3 className="flex items-center gap-2 text-xl font-semibold text-gray-900 md:font-bold">
          <IconPlugConnected className="stroke-1.5 size-6" aria-hidden />
          Connections
        </h3>

        <div className="flex items-center gap-4">
          <LinkButton
            intent="secondary"
            space="sm"
            iconLeft={<IconPlus className="stroke-1.5 size-4" />}
            to={`/orgs/${params.org_slug}/settings/connections/add-connection`}
          >
            Add
          </LinkButton>
        </div>
      </header>
      <ul className="divide-y divide-gray-200">
        {loaderData.connections.map((connection) => (
          <li key={connection.id} className="flex justify-between gap-6 py-5">
            <div className="flex grow gap-4">
              <div className="grow">
                <p className="font-semibold text-gray-900">
                  <Link
                    to={`/orgs/${params.org_slug}/settings/connections/${connection.id}/edit`}
                  >
                    {connection.name}
                  </Link>
                </p>
                <p className="mt-1 truncate text-xs text-gray-900">
                  {connection.data_provider}
                </p>
              </div>
              <div className="shrink-0">
                <VisibilityTag visibility={connection.visibility} />
              </div>
            </div>
            <div className="hidden shrink-0 sm:flex sm:flex-col sm:items-end">
              <LinkButton
                to={`/orgs/${params.org_slug}/settings/connections/${connection.id}/edit`}
                intent="secondary"
                space="sm"
              >
                Edit
              </LinkButton>
            </div>
          </li>
        ))}
      </ul>
    </Article>
  );
}
