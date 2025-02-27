import { mergeHeaders } from "@sort/sdk";
import {
  IconChevronLeft,
  IconChevronRight,
  IconDatabase,
  IconDatabaseSearch,
  IconPlus,
} from "@tabler/icons-react";
import { useEffect } from "react";
import type {
  LoaderFunctionArgs,
  MetaArgs,
  MetaDescriptor,
  UIMatch,
} from "react-router";
import {
  Link,
  useLoaderData,
  useParams,
  useRouteLoaderData,
} from "react-router";
import { Article } from "~/components/article";
import { BreadcrumbNavLink } from "~/components/breadcrumb-nav";
import { LinkButton } from "~/components/button";
import { DatabaseCard } from "~/components/database-card";
import {
  GlobalSidebarMenu,
  GlobalSidebarMenuNavLinkItem,
} from "~/components/global-sidebar";
import { MembersSidebar } from "~/components/members-sidebar";
import { Tag, getTagSpaceClasses } from "~/components/tag";
import { VisibilityTag } from "~/components/visibility-tag";
import type { loader as rootLoader } from "~/root";
import type { loader as orgLoader } from "~/routes/orgs/$org_slug";
import { client } from "~/sdk/client.server";
import {
  getDefaultRequestHeaders,
  getUserOrServiceAccountHeaders,
} from "~/services/auth.server";
import { dataFnMiddleware } from "~/utils/request.server";
import { assertResponseParams, extractMessageOrThrow } from "~/utils/response";

export function meta({ data }: MetaArgs<typeof loader>) {
  const count = data?.databases.length;

  return [
    { title: count ? `Databases (${count})` : "Databases" },
  ] satisfies MetaDescriptor[];
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  assertResponseParams(params, ["org_slug"]);
  const headers = mergeHeaders(
    getDefaultRequestHeaders(request),
    await getUserOrServiceAccountHeaders(request),
  );

  const [
    {
      payload: { databases },
    },
    {
      payload: { members },
    },
    {
      payload: { connections },
    },
  ] = await Promise.all([
    dataFnMiddleware(
      request,
      client.v2.listDatabases({
        headers,
        params,
      }),
    ).then(extractMessageOrThrow("list_databases")),
    dataFnMiddleware(
      request,
      client.v2.listOrganizationMembers({
        headers,
        params,
      }),
    ).then(extractMessageOrThrow("list_organization_members")),
    dataFnMiddleware(
      request,
      client.v2.listConnections({ headers, params }),
    ).then(extractMessageOrThrow("list_connections")),
  ]);

  return { connections, databases, members };
}

function Menu() {
  const rootLoaderData = useRouteLoaderData<typeof rootLoader>("root");
  const orgLoaderData = useRouteLoaderData<typeof orgLoader>(
    "routes/orgs/$org_slug",
  );
  const loaderData = useRouteLoaderData<typeof loader>(
    "routes/orgs/$org_slug/databases",
  );

  return (
    <GlobalSidebarMenu>
      {orgLoaderData ? (
        <GlobalSidebarMenuNavLinkItem
          end
          iconLeft={<IconChevronLeft className="stroke-1.5 size-6" />}
          title={orgLoaderData.organization.name}
          to={`/orgs/${orgLoaderData.organization.slug}`}
        >
          {orgLoaderData.organization.name}
        </GlobalSidebarMenuNavLinkItem>
      ) : rootLoaderData?.sortProfile ? (
        <GlobalSidebarMenuNavLinkItem
          title="My Organizations"
          to="/my/orgs"
          iconLeft={<IconChevronLeft className="stroke-1.5 size-6" />}
        >
          My Organizations
        </GlobalSidebarMenuNavLinkItem>
      ) : undefined}
      {orgLoaderData ? (
        <GlobalSidebarMenuNavLinkItem
          title="Databases"
          iconLeft={<IconDatabase className="stroke-1.5 size-6" />}
          end
          to={`/orgs/${orgLoaderData.organization.slug}/databases`}
        >
          Databases
        </GlobalSidebarMenuNavLinkItem>
      ) : undefined}
      {loaderData?.databases.map((database) => (
        <GlobalSidebarMenuNavLinkItem
          key={database.slug}
          end
          to={`/orgs/${database.organization_slug}/databases/${database.slug}`}
          title={database.display_name}
          iconLeft={<IconDatabase className="stroke-1.5 size-6" />}
          iconRight={<IconChevronRight className="stroke-1.5 size-5" />}
        >
          {database.display_name}
        </GlobalSidebarMenuNavLinkItem>
      ))}
    </GlobalSidebarMenu>
  );
}

export const handle = {
  breadcrumb(match: UIMatch) {
    return (
      <BreadcrumbNavLink end to={match.pathname}>
        Databases
      </BreadcrumbNavLink>
    );
  },
  menu: <Menu />,
};

export default function Route() {
  const orgLoaderData = useRouteLoaderData<typeof orgLoader>(
    "routes/orgs/$org_slug",
  );
  const loaderData = useLoaderData<typeof loader>();
  const params = useParams();

  useEffect(() => {
    if (
      loaderData.databases.length === 0 &&
      loaderData.connections.length > 0
    ) {
      const timer = setTimeout(() => {
        window.location.reload();
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [loaderData]);

  return (
    <Article>
      <div className="flex flex-col gap-4 md:flex-row">
        {loaderData.databases.length ? (
          <div className="flex grow flex-col gap-2 pb-9 md:gap-3">
            <header className="flex items-start justify-between">
              <h3 className="flex items-center gap-2 text-xl font-semibold text-gray-900 md:font-bold">
                <IconDatabase className="stroke-1.5 size-6" aria-hidden />
                Databases
              </h3>
              {orgLoaderData?.organization.permissions?.is_owner.value ? (
                <LinkButton
                  space="sm"
                  to={`/orgs/${params.org_slug}/settings/connections/add-connection`}
                  intent="secondary"
                >
                  Add Connection
                </LinkButton>
              ) : null}
            </header>
            <div className="grid grow grid-cols-1 gap-4 px-4 md:gap-6 md:p-0 xl:grid-cols-2">
              {loaderData.databases.map((database) => (
                <DatabaseCard
                  key={[database.connection_id, database.name].toString()}
                  cta={
                    <Link
                      to={`/orgs/${database.organization_slug}/databases/${database.slug}`}
                    >
                      {database.display_name}
                    </Link>
                  }
                  rawName={database.name}
                  summary={database.summary}
                  visibilityTag={
                    <VisibilityTag visibility={database.visibility} />
                  }
                  tags={[database.connection, database.data_provider].map(
                    (tag) => (
                      <Tag
                        key={tag}
                        intent="neutral"
                        className={getTagSpaceClasses("lg", "md")}
                      >
                        {tag}
                      </Tag>
                    ),
                  )}
                  buttonGroup={
                    <div className="inline-flex items-center gap-2">
                      <LinkButton
                        iconLeft={
                          <IconDatabaseSearch className="stroke-1.5 size-4" />
                        }
                        to={`/orgs/${database.organization_slug}/databases/${database.slug}/explorer`}
                        intent="secondary"
                        space="sm"
                      >
                        Explore
                      </LinkButton>
                      <LinkButton
                        to={`/orgs/${database.organization_slug}/databases/${database.slug}`}
                        intent="secondary"
                        space="sm"
                      >
                        Overview
                      </LinkButton>
                    </div>
                  }
                />
              ))}
            </div>
          </div>
        ) : loaderData?.connections.length ? (
          <div className="flex grow flex-col gap-2 pb-9 md:gap-3">
            <header className="flex items-start justify-between">
              <h3 className="flex items-center gap-2 text-xl font-semibold text-gray-900 md:font-bold">
                <IconDatabase className="stroke-1.5 size-6" aria-hidden />
                Databases
              </h3>
            </header>
            <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-blue-100 px-4 py-8">
              <p className="text-center text-xl text-gray-700">
                Please wait while we import your databases...
              </p>
              <LinkButton to={`/orgs/${params.org_slug}/databases`}>
                Refresh
              </LinkButton>
            </div>
          </div>
        ) : orgLoaderData?.organization.permissions?.is_owner.value ? (
          <div className="flex grow flex-col items-center justify-center">
            <h3 className="text-xl font-semibold text-gray-900 md:text-2xl md:font-bold">
              Add Connection
            </h3>
            <div className="flex max-w-prose flex-col gap-2 py-6 text-center">
              <p>
                There are no databases to display. Adding your database
                connection allows you to query it using SQL, save and share your
                queries with your team, and more.
              </p>
              <p>Add your database connection to get started.</p>
            </div>
            <LinkButton
              to={`/orgs/${params.org_slug}/settings/connections/add-connection`}
              iconLeft={<IconPlus className="stroke-1.5 size-6" />}
            >
              Add Connection
            </LinkButton>
          </div>
        ) : (
          <div className="flex grow flex-col items-center justify-center">
            <h3 className="text-xl font-semibold text-gray-900 md:text-2xl md:font-bold">
              No Databases
            </h3>
            <div className="flex max-w-prose flex-col gap-2 py-6 text-center">
              <p>This organization has no databases to display.</p>
            </div>
          </div>
        )}
        <hr className="border-gray-300 md:hidden" />
        {orgLoaderData?.organization ? (
          <MembersSidebar
            members={loaderData.members}
            params={params}
            organization={orgLoaderData.organization}
          />
        ) : undefined}
      </div>
    </Article>
  );
}
