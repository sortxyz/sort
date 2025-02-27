import { mergeHeaders } from "@sort/sdk";
import {
  IconBuilding,
  IconChevronLeft,
  IconChevronRight,
  IconDashboard,
  IconDatabase,
  IconPlus,
  IconSettings,
  IconUsers,
} from "@tabler/icons-react";
import type {
  LoaderFunctionArgs,
  MetaArgs,
  MetaDescriptor,
  UIMatch,
} from "react-router";
import { useRouteLoaderData } from "react-router";
import { BreadcrumbNavLink } from "~/components/breadcrumb-nav";
import { AnchorButton, LinkButton } from "~/components/button";
import {
  DefaultGenericStatusHandler,
  GeneralErrorBoundary,
} from "~/components/general-error-boundary";
import {
  GlobalSidebarMenu,
  GlobalSidebarMenuNavLinkItem,
} from "~/components/global-sidebar";
import { client } from "~/sdk/client.server";
import {
  getDefaultRequestHeaders,
  getUserOrServiceAccountHeaders,
} from "~/services/auth.server";
import { dataFnMiddleware } from "~/utils/request.server";
import { assertResponseParams, extractMessageOrThrow } from "~/utils/response";

export function meta({ data }: MetaArgs<typeof loader>) {
  return [
    { title: data?.organization.name ?? "Organization Overview" },
  ] satisfies MetaDescriptor[];
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  assertResponseParams(params, ["org_slug"]);
  const headers = mergeHeaders(
    getDefaultRequestHeaders(request),
    await getUserOrServiceAccountHeaders(request),
  );
  const {
    payload: { organization },
  } = await dataFnMiddleware(
    request,
    client.v2.getOrganization({
      headers,
      params,
    }),
  ).then(extractMessageOrThrow("get_organization"));

  return { organization };
}

function Menu() {
  const loaderData = useRouteLoaderData<typeof loader>("routes/orgs/$org_slug");

  return (
    <GlobalSidebarMenu>
      <GlobalSidebarMenuNavLinkItem
        end
        iconLeft={<IconChevronLeft className="stroke-1.5 size-6" />}
        title="My Organizations"
        to="/my/orgs"
      >
        My Organizations
      </GlobalSidebarMenuNavLinkItem>
      {loaderData ? (
        <GlobalSidebarMenuNavLinkItem
          title={loaderData.organization.name}
          iconLeft={<IconBuilding className="stroke-1.5 size-6" />}
          end
          to={`/orgs/${loaderData.organization.slug}`}
        >
          {loaderData.organization.name}
        </GlobalSidebarMenuNavLinkItem>
      ) : undefined}
      {loaderData ? (
        <GlobalSidebarMenuNavLinkItem
          title="Dashboard"
          iconLeft={<IconDashboard className="stroke-1.5 size-6" />}
          end
          to={`/orgs/${loaderData.organization.slug}/dashboard`}
        >
          Dashboard
        </GlobalSidebarMenuNavLinkItem>
      ) : undefined}
      {loaderData ? (
        <GlobalSidebarMenuNavLinkItem
          title="Databases"
          iconLeft={<IconDatabase className="stroke-1.5 size-6" />}
          iconRight={<IconChevronRight className="stroke-1.5 size-5" />}
          end
          to={`/orgs/${loaderData.organization.slug}/databases`}
        >
          Databases
        </GlobalSidebarMenuNavLinkItem>
      ) : undefined}
      {loaderData ? (
        <GlobalSidebarMenuNavLinkItem
          title="Members"
          iconLeft={<IconUsers className="stroke-1.5 size-6" />}
          iconRight={<IconChevronRight className="stroke-1.5 size-5" />}
          end
          to={`/orgs/${loaderData.organization.slug}/members`}
        >
          Members
        </GlobalSidebarMenuNavLinkItem>
      ) : undefined}
      {loaderData?.organization.permissions?.view_settings.value ? (
        <GlobalSidebarMenuNavLinkItem
          title="Settings"
          iconLeft={<IconSettings className="stroke-1.5 size-6" />}
          iconRight={<IconChevronRight className="stroke-1.5 size-5" />}
          end
          to={`/orgs/${loaderData.organization.slug}/settings`}
        >
          Settings
        </GlobalSidebarMenuNavLinkItem>
      ) : undefined}
    </GlobalSidebarMenu>
  );
}

export const handle = {
  breadcrumb(match: UIMatch<Awaited<ReturnType<typeof loader>>>) {
    return (
      <BreadcrumbNavLink end to={match.pathname}>
        {match.data?.organization.name ?? "Not Found"}
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
              It seems &quot;{params.org_slug}&quot; does not exist.
            </p>

            <div className="inline-flex items-center gap-2">
              <AnchorButton intent="secondary" href="/">
                Return Home
              </AnchorButton>
              <LinkButton
                to={{
                  pathname: "/orgs/new",
                  search: params.org_slug
                    ? new URLSearchParams({
                        org_slug: params.org_slug,
                      }).toString()
                    : undefined,
                }}
                iconLeft={<IconPlus className="stroke-1.5 size-6" />}
              >
                Create It
              </LinkButton>
            </div>
          </>
        ),
      }}
    />
  );
}
