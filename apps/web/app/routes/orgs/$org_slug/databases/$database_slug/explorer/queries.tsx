import { mergeHeaders } from "@sort/sdk";
import {
  IconChevronLeft,
  IconReportSearch,
  IconSearch,
} from "@tabler/icons-react";
import clsx from "clsx";
import { useContext } from "react";
import type { LoaderFunctionArgs } from "react-router";
import {
  NavLink,
  Outlet,
  redirectDocument,
  useParams,
  useRouteLoaderData,
} from "react-router";
import {
  GlobalSidebarMenu,
  GlobalSidebarMenuNavLinkItem,
} from "~/components/global-sidebar";
import { GlobalSidebarCollapsedContext } from "~/components/global-sidebar/global-sidebar-collapsed-context";
import { Spinner } from "~/components/spinner";
import type { loader as databaseLoader } from "~/routes/orgs/$org_slug/databases/$database_slug";
import { client } from "~/sdk/client.server";
import {
  getDefaultRequestHeaders,
  getUserOrServiceAccountHeaders,
} from "~/services/auth.server";
import { setFlashHeaders, setFlashHeadersFromRequest } from "~/utils/flash";
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
      payload: { schemas },
    },
    {
      payload: { queries },
    },
  ] = await Promise.all([
    dataFnMiddleware(
      request,
      client.v2.listDatabaseSchemas({
        headers,
        params,
      }),
    ).then(extractMessageOrThrow("list_database_schemas")),
    dataFnMiddleware(
      request,
      client.v2.listQueries({
        headers,
        params,
        searchParams: new URLSearchParams({
          database_slug: params.database_slug,
        }),
      }),
    ).then(extractMessageOrThrow("list_queries")),
  ]);

  const query = queries[0];

  if (!query) {
    const url = new URL(request.url);
    const currentSchema = url.searchParams.get("schema_name") ?? "public";
    const schema_name =
      schemas.find((schema) => schema.name === currentSchema)?.name ??
      schemas[0]?.name ??
      "public";

    throw redirectDocument(
      `/orgs/${params.org_slug}/databases/${params.database_slug}/explorer/schemas/${schema_name}/tables`,
      {
        headers: await setFlashHeaders({
          type: "error",
          message: "No queries found",
        }),
      },
    );
  }

  if (!params.query_id) {
    throw redirectDocument(
      `/orgs/${params.org_slug}/databases/${params.database_slug}/explorer/queries/${query.id}`,
      {
        headers: await setFlashHeadersFromRequest(request),
      },
    );
  }

  return { schemas, queries };
}

function Menu() {
  const databaseLoaderData = useRouteLoaderData<typeof databaseLoader>(
    "routes/orgs/$org_slug/databases/$database_slug",
  );
  const loaderData = useRouteLoaderData<typeof loader>(
    "routes/orgs/$org_slug/databases/$database_slug/explorer/queries",
  );
  const params = useParams();
  const collapsed = useContext(GlobalSidebarCollapsedContext);
  const schema_name =
    loaderData?.schemas.find((schema) => schema.name === "public")?.name ??
    loaderData?.schemas?.[0]?.name ??
    "public";

  return (
    <GlobalSidebarMenu>
      {databaseLoaderData ? (
        <GlobalSidebarMenuNavLinkItem
          end
          iconLeft={<IconChevronLeft className="stroke-1.5 size-6" />}
          title={
            databaseLoaderData.database.display_name ??
            databaseLoaderData.database.raw_name
          }
          to={`/orgs/${params.org_slug}/databases/${params.database_slug}`}
        >
          {databaseLoaderData.database.display_name ??
            databaseLoaderData.database.raw_name}
        </GlobalSidebarMenuNavLinkItem>
      ) : undefined}
      <GlobalSidebarMenuNavLinkItem
        iconLeft={<IconSearch className="stroke-1.5 size-6" />}
        title="Data Explorer"
        to={`/orgs/${params.org_slug}/databases/${params.database_slug}/explorer/queries/${params.query_id}`}
      >
        Data Explorer
      </GlobalSidebarMenuNavLinkItem>
      <header
        className={clsx("sticky top-0 flex-col gap-2", {
          "flex lg:hidden": collapsed,
          flex: !collapsed,
        })}
      >
        <nav className="flex items-center rounded-lg border border-gray-300 bg-gray-200 p-1">
          <NavLink
            to={`/orgs/${params.org_slug}/databases/${params.database_slug}/explorer/schemas/${schema_name}/tables`}
            className="grow cursor-pointer rounded-lg py-1 text-center text-sm text-gray-900 shadow-xs aria-current-page:bg-white"
          >
            Tables
          </NavLink>
          <NavLink
            to={
              params.query_id
                ? `/orgs/${params.org_slug}/databases/${params.database_slug}/explorer/queries/${params.query_id}`
                : `/orgs/${params.org_slug}/databases/${params.database_slug}/explorer/queries`
            }
            className="grow cursor-pointer rounded-lg py-1 text-center text-sm text-gray-900 shadow-xs aria-current-page:bg-white"
          >
            Queries
          </NavLink>
        </nav>
      </header>
      <ul
        className={clsx("grow flex-col gap-2 overflow-y-auto p-4 md:px-0", {
          "flex lg:hidden": collapsed,
          flex: !collapsed,
        })}
      >
        {!loaderData?.queries.length ? (
          <li className="block">
            <span className="block truncate px-4 py-2 text-lg">
              No results found
            </span>
          </li>
        ) : undefined}
        {loaderData?.queries.map((query) => (
          <li className="block" key={query.id}>
            <NavLink
              to={`/orgs/${query.org_slug}/databases/${query.database_slug}/explorer/queries/${query.id}`}
              className={clsx(
                "flex cursor-pointer items-center gap-2 truncate rounded-sm p-2 text-sm font-medium aria-current-page:bg-blue-600 aria-current-page:text-white",
              )}
            >
              {(props) => (
                <>
                  <span>
                    {props.isPending || props.isTransitioning ? (
                      <Spinner className="size-5 animate-spin" />
                    ) : (
                      <IconReportSearch className="stroke-1.5 size-5" />
                    )}
                  </span>
                  <span>{query.name}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </GlobalSidebarMenu>
  );
}

export const handle = {
  hideFooter: true,
  menu: <Menu />,
};

export default function Route() {
  return <Outlet />;
}
