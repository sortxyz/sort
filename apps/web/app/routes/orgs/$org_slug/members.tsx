import {
  IconChevronLeft,
  IconMail,
  IconPlus,
  IconUsers,
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
        iconLeft={<IconUsers className="stroke-1.5 size-6" />}
        title="Members"
        end
        to={`/orgs/${params.org_slug}/members`}
      >
        Members
      </GlobalSidebarMenuNavLinkItem>
      {orgLoaderData?.organization.permissions?.view_invites.value ? (
        <GlobalSidebarMenuNavLinkItem
          iconLeft={<IconMail className="stroke-1.5 size-6" />}
          title="Invites"
          end
          to={`/orgs/${params.org_slug}/members/invites`}
        >
          Invites
        </GlobalSidebarMenuNavLinkItem>
      ) : undefined}
      {orgLoaderData?.organization.permissions?.view_invites.value ? (
        <GlobalSidebarMenuNavLinkItem
          iconLeft={<IconPlus className="size-6" />}
          title="New Invite"
          end
          to={`/orgs/${params.org_slug}/members/invites/new`}
        >
          New Invite
        </GlobalSidebarMenuNavLinkItem>
      ) : undefined}
    </GlobalSidebarMenu>
  );
}

export const handle = {
  breadcrumb(match: UIMatch) {
    return (
      <BreadcrumbNavLink end to={match.pathname}>
        Members
      </BreadcrumbNavLink>
    );
  },
  menu: <Menu />,
};
