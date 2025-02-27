import { mergeHeaders } from "@sort/sdk";
import {
  IconChevronLeft,
  IconDatabase,
  IconDatabaseSearch,
  IconGitPullRequest,
  IconLabel,
  IconSettings,
  IconTicket,
} from "@tabler/icons-react";
import type { LoaderFunctionArgs, UIMatch } from "react-router";
import { useParams, useRouteLoaderData } from "react-router";
import { BreadcrumbNavLink } from "~/components/breadcrumb-nav";
import { AnchorButton } from "~/components/button";
import {
  DefaultGenericStatusHandler,
  GeneralErrorBoundary,
} from "~/components/general-error-boundary";
import {
  GlobalSidebarMenu,
  GlobalSidebarMenuNavLinkItem,
} from "~/components/global-sidebar";
import type { loader as orgLoader } from "~/routes/orgs/$org_slug";
import { client } from "~/sdk/client.server";
import {
  getDefaultRequestHeaders,
  getUserOrServiceAccountHeaders,
} from "~/services/auth.server";
import { getFlags } from "~/services/flags.server";
import { dataFnMiddleware } from "~/utils/request.server";
import { assertResponseParams, extractMessageOrThrow } from "~/utils/response";

export async function loader({ request, params }: LoaderFunctionArgs) {
  assertResponseParams(params, ["org_slug", "database_slug"]);
  const headers = mergeHeaders(
    getDefaultRequestHeaders(request),
    await getUserOrServiceAccountHeaders(request),
  );

  const [
    {
      payload: { database },
    },
    {
      payload: { connection },
    },
  ] = await Promise.all([
    dataFnMiddleware(
      request,
      client.v2.getDatabase({
        headers,
        params,
      }),
    ).then(extractMessageOrThrow("get_database")),
    dataFnMiddleware(
      request,
      client.v2.getDatabaseConnection({
        headers,
        params,
      }),
    ).then(extractMessageOrThrow("get_database_connection")),
  ]);

  const flags = await getFlags(request);
  return {
    flags,
    database,
    connection,
  };
}

function Menu() {
  const orgLoaderData = useRouteLoaderData<typeof orgLoader>(
    "routes/orgs/$org_slug",
  );
  const loaderData = useRouteLoaderData<typeof loader>(
    "routes/orgs/$org_slug/databases/$database_slug",
  );
  const params = useParams();
  return (
    <GlobalSidebarMenu>
      <GlobalSidebarMenuNavLinkItem
        end
        iconLeft={<IconChevronLeft className="stroke-1.5 size-6" />}
        title="Databases"
        to={`/orgs/${params.org_slug}/databases`}
      >
        Databases
      </GlobalSidebarMenuNavLinkItem>
      <GlobalSidebarMenuNavLinkItem
        iconLeft={<IconDatabase className="stroke-1.5 size-6" />}
        title={loaderData?.database.display_name ?? "Overview"}
        end
        to={`/orgs/${params.org_slug}/databases/${params.database_slug}`}
      >
        {loaderData?.database.display_name ?? "Overview"}
      </GlobalSidebarMenuNavLinkItem>
      <GlobalSidebarMenuNavLinkItem
        iconLeft={<IconDatabaseSearch className="stroke-1.5 size-6" />}
        title="Data Explorer"
        to={`/orgs/${params.org_slug}/databases/${params.database_slug}/explorer`}
      >
        Data Explorer
      </GlobalSidebarMenuNavLinkItem>
      {loaderData?.flags.changeRequests ? (
        <GlobalSidebarMenuNavLinkItem
          iconLeft={<IconGitPullRequest className="stroke-1.5 size-6" />}
          title="Change Requests"
          to={`/orgs/${params.org_slug}/databases/${params.database_slug}/change-requests`}
        >
          Change Requests
        </GlobalSidebarMenuNavLinkItem>
      ) : undefined}
      <GlobalSidebarMenuNavLinkItem
        iconLeft={<IconTicket className="stroke-1.5 size-6" />}
        title="Issues"
        to={`/orgs/${params.org_slug}/databases/${params.database_slug}/issues`}
      >
        Issues
      </GlobalSidebarMenuNavLinkItem>
      <GlobalSidebarMenuNavLinkItem
        iconLeft={<IconLabel className="stroke-1.5 size-6" />}
        title="Labels"
        to={`/orgs/${params.org_slug}/databases/${params.database_slug}/labels`}
      >
        Labels
      </GlobalSidebarMenuNavLinkItem>
      {orgLoaderData?.organization.permissions?.view_database_settings.value ? (
        <GlobalSidebarMenuNavLinkItem
          iconLeft={<IconSettings className="stroke-1.5 size-6" />}
          title="Database Settings"
          end
          to={`/orgs/${params.org_slug}/databases/${params.database_slug}/edit`}
        >
          Database Settings
        </GlobalSidebarMenuNavLinkItem>
      ) : undefined}
    </GlobalSidebarMenu>
  );
}

export const handle = {
  breadcrumb(match: UIMatch<Awaited<ReturnType<typeof loader>>>) {
    return (
      <BreadcrumbNavLink end to={match.pathname}>
        {match.data?.database.display_name ?? "Overview"}
      </BreadcrumbNavLink>
    );
  },
  menu: <Menu />,
};

export function ErrorBoundary() {
  return (
    <GeneralErrorBoundary
      statusHandlers={{
        404: ({ error, params }) => (
          <>
            <DefaultGenericStatusHandler error={error} params={params} />
            <p className="my-4">
              It seems &quot;{params.database_slug}&quot; does not exist.
            </p>
            <AnchorButton intent="secondary" href="/">
              Return Home
            </AnchorButton>
          </>
        ),
      }}
    />
  );
}
