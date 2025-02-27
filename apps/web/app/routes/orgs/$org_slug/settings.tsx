import {
  IconChevronLeft,
  IconPlugConnected,
  IconPlus,
  IconSettings,
} from "@tabler/icons-react";
import type { UIMatch } from "react-router";
import { useParams, useRouteLoaderData } from "react-router";
import { BreadcrumbNavLink } from "~/components/breadcrumb-nav";
import {
  GlobalSidebarMenu,
  GlobalSidebarMenuNavLinkItem,
} from "~/components/global-sidebar";
import type { loader as orgLoader } from "~/routes/orgs/$org_slug";

function Menu() {
  const orgLoaderData = useRouteLoaderData<typeof orgLoader>(
    "routes/orgs/$org_slug",
  );
  const params = useParams();

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
      ) : undefined}
      <GlobalSidebarMenuNavLinkItem
        title="Settings"
        iconLeft={<IconSettings className="stroke-1.5 size-6" />}
        end
        to={`/orgs/${params.org_slug}/settings`}
      >
        Settings
      </GlobalSidebarMenuNavLinkItem>
      <GlobalSidebarMenuNavLinkItem
        title="Connections"
        iconLeft={<IconPlugConnected className="stroke-1.5 size-6" />}
        end
        to={`/orgs/${params.org_slug}/settings/connections`}
      >
        Connections
      </GlobalSidebarMenuNavLinkItem>
      <GlobalSidebarMenuNavLinkItem
        title="Add Connection"
        iconLeft={<IconPlus className="stroke-1.5 size-6" />}
        end
        to={`/orgs/${params.org_slug}/settings/connections/add-connection`}
      >
        Add Connection
      </GlobalSidebarMenuNavLinkItem>
    </GlobalSidebarMenu>
  );
}

export const handle = {
  breadcrumb(match: UIMatch) {
    return (
      <BreadcrumbNavLink end to={match.pathname}>
        Settings
      </BreadcrumbNavLink>
    );
  },
  menu: <Menu />,
};
