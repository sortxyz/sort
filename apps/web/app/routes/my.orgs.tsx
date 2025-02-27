import { mergeHeaders } from "@sort/sdk";
import { IconBuilding, IconChevronRight, IconPlus } from "@tabler/icons-react";
import type { LoaderFunctionArgs, MetaDescriptor } from "react-router";
import { Link, useLoaderData, useRouteLoaderData } from "react-router";
import { Article } from "~/components/article";
import { LinkButton } from "~/components/button";
import {
  GlobalSidebarMenu,
  GlobalSidebarMenuNavLinkItem,
} from "~/components/global-sidebar";
import { Table, TableBody, TableCell, TableRow } from "~/components/table";
import { client } from "~/sdk/client.server";
import {
  getDefaultRequestHeaders,
  getRequiredUserHeaders,
} from "~/services/auth.server";

import { dataFnMiddleware } from "~/utils/request.server";
import { extractMessageOrThrow } from "~/utils/response";

export function meta() {
  return [{ title: "My Organizations" }] satisfies MetaDescriptor[];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const headers = mergeHeaders(
    getDefaultRequestHeaders(request),
    await getRequiredUserHeaders(request),
  );
  const {
    payload: { organizations },
  } = await dataFnMiddleware(
    request,
    client.v2.listMyOrganizations({
      headers,
    }),
  ).then(extractMessageOrThrow("list_my_organizations"));

  return { organizations };
}

function Menu() {
  const loaderData = useRouteLoaderData<typeof loader>("routes/my.orgs");
  return (
    <GlobalSidebarMenu>
      <GlobalSidebarMenuNavLinkItem
        title="My Organizations"
        iconLeft={<IconBuilding className="stroke-1.5 size-5" />}
        end
        to="/my/orgs"
      >
        My Organizations
      </GlobalSidebarMenuNavLinkItem>
      {loaderData?.organizations.map((organization) => (
        <GlobalSidebarMenuNavLinkItem
          key={organization.slug}
          title={organization.name}
          iconLeft={<IconBuilding className="stroke-1.5 size-6" />}
          iconRight={<IconChevronRight className="stroke-1.5 size-5" />}
          end
          to={`/orgs/${organization.slug}`}
        >
          {organization.name}
        </GlobalSidebarMenuNavLinkItem>
      ))}
      <div>
        <GlobalSidebarMenuNavLinkItem
          title="Add Organization"
          iconLeft={<IconPlus className="stroke-1.5 size-6" />}
          end
          to="/orgs/new"
        >
          Add Organization
        </GlobalSidebarMenuNavLinkItem>
      </div>
    </GlobalSidebarMenu>
  );
}

export const handle = {
  menu: <Menu />,
};

export default function Route() {
  const loaderData = useLoaderData<typeof loader>();
  return loaderData.organizations.length ? (
    <Article>
      <header className="flex flex-col justify-between gap-4 pt-6 pb-3 md:flex-row md:items-start">
        <h3 className="flex items-center gap-2 text-xl font-semibold text-gray-900 md:font-bold">
          <IconBuilding className="stroke-1.5 size-6" aria-hidden />
          My Organizations
        </h3>
        <LinkButton
          to="/orgs/new"
          space="sm"
          intent="secondary"
          iconLeft={<IconPlus className="stroke-1.5 size-4" />}
        >
          Add Organization
        </LinkButton>
      </header>
      <Table>
        <TableBody>
          {loaderData.organizations.map((organization) => (
            <TableRow key={organization.id}>
              <TableCell space="md">
                <Link to={`/orgs/${organization.slug}`}>
                  {organization.name}
                </Link>
              </TableCell>
              <TableCell space="md" textAlign="right">
                <LinkButton
                  to={`/orgs/${organization.slug}`}
                  intent="secondary"
                  space="sm"
                >
                  View Organization
                </LinkButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Article>
  ) : (
    <Article>
      <h3 className="flex items-center gap-2 text-xl font-semibold text-gray-900 md:text-3xl md:font-bold">
        <IconBuilding className="stroke-1.5 size-6" aria-hidden />
        My Organizations
      </h3>

      <div className="flex max-w-prose flex-col gap-4 self-center py-4 text-center md:gap-8">
        <p>
          There are no organizations to display. Adding your organization allows
          you to create database connections, add members to collaborate with
          your team, and more.
        </p>
        <p>Add your organization to get started.</p>
        <div>
          <LinkButton
            iconLeft={<IconPlus className="stroke-1.5 size-6" />}
            to="/orgs/new"
          >
            Add Organization
          </LinkButton>
        </div>
      </div>
    </Article>
  );
}
