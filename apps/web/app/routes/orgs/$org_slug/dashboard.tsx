import { mergeHeaders } from "@sort/sdk";
import { IconDashboard } from "@tabler/icons-react";
import type { LoaderFunctionArgs, UIMatch } from "react-router";
import {
  useLoaderData,
  useParams,
  useRouteLoaderData,
  useSearchParams,
} from "react-router";
import { Article } from "~/components/article";
import { BreadcrumbNavLink } from "~/components/breadcrumb-nav";
import { Button } from "~/components/button";
import { DashboardListItem } from "~/components/dashboard-list-item";
import { Markdown } from "~/components/markdown";
import type { loader as orgLoader } from "~/routes/orgs/$org_slug";
import { client } from "~/sdk/client.server";
import {
  getDefaultRequestHeaders,
  getUserOrServiceAccountHeaders,
} from "~/services/auth.server";
import { dataFnMiddleware } from "~/utils/request.server";
import { assertResponseParams, extractMessageOrThrow } from "~/utils/response";

export const handle = {
  breadcrumb(match: UIMatch) {
    return (
      <BreadcrumbNavLink end to={match.pathname}>
        Dashboard
      </BreadcrumbNavLink>
    );
  },
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  assertResponseParams(params, ["org_slug"]);

  const headers = mergeHeaders(
    getDefaultRequestHeaders(request),
    await getUserOrServiceAccountHeaders(request),
  );

  const url = new URL(request.url);
  const searchParams = url.searchParams;

  // always open
  searchParams.set("status", "open");

  const [
    {
      payload: { dashboard },
    },
    {
      payload: { members },
    },
  ] = await Promise.all([
    dataFnMiddleware(
      request,
      client.v2.getOrganizationDashboard({
        headers,
        params,
        searchParams,
      }),
    ).then(extractMessageOrThrow("get_organization_dashboard")),
    dataFnMiddleware(
      request,
      client.v2.listOrganizationMembers({
        headers,
        params,
      }),
    ).then(extractMessageOrThrow("list_organization_members")),
  ]);

  return {
    dashboard,
    members,
  };
}

export default function Route() {
  const orgLoaderData = useRouteLoaderData<typeof orgLoader>(
    "routes/orgs/$org_slug",
  );
  const loaderData = useLoaderData<typeof loader>();
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  return (
    <Article>
      {orgLoaderData?.organization.banner ? (
        <div className="prose prose-lg max-w-none rounded-lg bg-yellow-50 p-4">
          <Markdown>{orgLoaderData.organization.banner}</Markdown>
        </div>
      ) : undefined}
      <header className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xl font-semibold text-gray-900 md:font-bold">
          <IconDashboard className="stroke-1.5 size-6" aria-hidden />
          Dashboard
        </h3>
      </header>

      <div className="space-y-4">
        <div className="md:grow md:rounded-xl md:border md:border-gray-300">
          <div className="flex justify-between gap-2 py-3 md:rounded-t-xl md:border-b md:border-gray-300 md:bg-gray-50 md:px-10">
            <div>
              <div className="inline-flex items-center gap-2">
                <Button
                  type="button"
                  space="xs"
                  intent="secondary"
                  onClick={() =>
                    setSearchParams((searchParams) => {
                      searchParams.delete("items");
                      return searchParams;
                    })
                  }
                  aria-pressed={!searchParams.has("items")}
                >
                  All
                </Button>
                <Button
                  type="button"
                  space="xs"
                  intent="secondary"
                  onClick={() =>
                    setSearchParams((searchParams) => {
                      searchParams.set("items", "change_requests");
                      return searchParams;
                    })
                  }
                  aria-pressed={searchParams.get("items") === "change_requests"}
                >
                  Change Requests
                </Button>
                <Button
                  type="button"
                  space="xs"
                  intent="secondary"
                  onClick={() =>
                    setSearchParams((searchParams) => {
                      searchParams.set("items", "issues");
                      return searchParams;
                    })
                  }
                  aria-pressed={searchParams.get("items") === "issues"}
                >
                  Issues
                </Button>
              </div>
            </div>
            <div className="hidden text-gray-700 md:block">People</div>
          </div>
          <div className="md:grow md:rounded-b-xl md:border md:border-gray-300">
            <div>
              {loaderData.dashboard.length ? (
                <ol className="-mx-4 divide-y divide-gray-300 md:mx-0">
                  {loaderData.dashboard.map((dashboard) => (
                    <DashboardListItem
                      dashboard={dashboard}
                      key={dashboard.id}
                      members={loaderData.members}
                      org_slug={params.org_slug!}
                    />
                  ))}
                </ol>
              ) : (
                <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-blue-100 px-4 py-8">
                  <h2 className="text-center font-medium text-gray-900">
                    No Change Requests or Issues found
                  </h2>
                  <p className="text-center text-sm text-gray-700">
                    Create an issue to ask for help with a database query, point
                    out incorrect data, or ask for additional data to be added.
                    Create a change request from the Data Explorer to update the
                    data in this database.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Article>
  );
}
