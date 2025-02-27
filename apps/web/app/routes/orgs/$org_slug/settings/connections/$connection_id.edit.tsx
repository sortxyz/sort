import { mergeHeaders } from "@sort/sdk";
import type { LoaderFunctionArgs, UIMatch } from "react-router";
import { Outlet, useMatch, useParams } from "react-router";
import { Article } from "~/components/article";
import { BreadcrumbNavLink } from "~/components/breadcrumb-nav";
import {
  Tabs,
  TabsList,
  TabsListNavLinkTab,
  TabsPanel,
} from "~/components/tabs";
import { client } from "~/sdk/client.server";
import {
  getDefaultRequestHeaders,
  getRequiredUserHeaders,
} from "~/services/auth.server";
import { dataFnMiddleware } from "~/utils/request.server";
import { assertResponseParams, extractMessageOrThrow } from "~/utils/response";

export async function loader({ request, params }: LoaderFunctionArgs) {
  assertResponseParams(params, ["org_slug", "connection_id"]);
  const headers = mergeHeaders(
    getDefaultRequestHeaders(request),
    await getRequiredUserHeaders(request),
  );

  const {
    payload: { connection },
  } = await dataFnMiddleware(
    request,
    client.v2.getConnection({
      headers,
      params,
    }),
  ).then(extractMessageOrThrow("get_connection"));

  return {
    connection,
  };
}

export const handle = {
  breadcrumb(match: UIMatch<Awaited<ReturnType<typeof loader>>>) {
    return (
      <BreadcrumbNavLink end to={match.pathname}>
        {match.data?.connection.name ?? "Connection"}
      </BreadcrumbNavLink>
    );
  },
};

export default function Route() {
  const params = useParams();

  const selectedIndex = useMatch({
    path: "/orgs/:org_slug/settings/connections/:connection_id/edit/advanced",
    end: true,
  })
    ? 1
    : 0;

  return (
    <Article>
      <Tabs selectedIndex={selectedIndex} category="underlined">
        <TabsList aria-label="Connection Settings">
          <TabsListNavLinkTab
            index={0}
            end
            to={`/orgs/${params.org_slug}/settings/connections/${params.connection_id}/edit`}
          >
            Connection Details
          </TabsListNavLinkTab>
          <TabsListNavLinkTab
            index={1}
            end
            to={`/orgs/${params.org_slug}/settings/connections/${params.connection_id}/edit/advanced`}
          >
            Advanced Settings
          </TabsListNavLinkTab>
        </TabsList>
        <TabsPanel index={0} className="py-4 md:py-8">
          {selectedIndex === 0 ? <Outlet /> : undefined}
        </TabsPanel>
        <TabsPanel index={1} className="py-4 md:py-8">
          {selectedIndex === 1 ? <Outlet /> : undefined}
        </TabsPanel>
      </Tabs>
    </Article>
  );
}
