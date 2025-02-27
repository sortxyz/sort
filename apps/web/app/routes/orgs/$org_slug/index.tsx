import { mergeHeaders } from "@sort/sdk";
import {
  IconDatabase,
  IconDatabaseSearch,
  IconLink,
} from "@tabler/icons-react";
import type { LoaderFunctionArgs } from "react-router";
import {
  Link,
  useLoaderData,
  useParams,
  useRouteLoaderData,
} from "react-router";
import { Anchor } from "~/components/anchor";
import { Article } from "~/components/article";
import { LinkButton } from "~/components/button";
import { DatabaseCard } from "~/components/database-card";
import { Markdown } from "~/components/markdown";
import { MembersSidebar } from "~/components/members-sidebar";
import { Tag, getTagSpaceClasses } from "~/components/tag";
import { VisibilityTag } from "~/components/visibility-tag";
import type { loader as orgLoader } from "~/routes/orgs/$org_slug";
import { client } from "~/sdk/client.server";

import {
  getDefaultRequestHeaders,
  getUserOrServiceAccountHeaders,
} from "~/services/auth.server";
import { dataFnMiddleware } from "~/utils/request.server";
import { assertResponseParams, extractMessageOrThrow } from "~/utils/response";

export async function loader({ request, params }: LoaderFunctionArgs) {
  assertResponseParams(params, ["org_slug"]);
  const headers = mergeHeaders(
    getDefaultRequestHeaders(request),
    await getUserOrServiceAccountHeaders(request),
  );
  const [
    {
      payload: { members },
    },
    {
      payload: { databases },
    },
  ] = await Promise.all([
    dataFnMiddleware(
      request,
      client.v2.listOrganizationMembers({
        headers,
        params,
      }),
    ).then(extractMessageOrThrow("list_organization_members")),
    dataFnMiddleware(
      request,
      client.v2.listDatabases({
        headers,
        params,
      }),
    ).then(extractMessageOrThrow("list_databases")),
  ]);

  return {
    members,
    databases: databases.slice(0, 6),
    hasMoreDatabases: databases.length > 6,
  };
}

export default function Route() {
  const orgLoaderData = useRouteLoaderData<typeof orgLoader>(
    "routes/orgs/$org_slug",
  );
  const loaderData = useLoaderData<typeof loader>();
  const params = useParams();

  return (
    <Article>
      <div className="flex flex-col justify-center gap-4 md:flex-row">
        <div className="flex-1 rounded-md border border-gray-300 md:grow">
          <div className="rounded-t-md border-b border-black/10 bg-gray-100 px-5 py-1.5">
            <h3 className="text-sm/6 font-semibold text-gray-700">
              Description
            </h3>
            {orgLoaderData?.organization.link ? (
              <Anchor
                href={orgLoaderData.organization.link}
                target="_blank"
                rel="noopener noreferrer"
                iconLeft={<IconLink className="stroke-1.5 size-4" />}
              >
                {new URL(orgLoaderData.organization.link).hostname}
              </Anchor>
            ) : undefined}
          </div>
          {orgLoaderData?.organization.description ? (
            <div className="prose prose-sm p-5">
              <Markdown>{orgLoaderData.organization.description}</Markdown>
            </div>
          ) : undefined}
        </div>
        <hr className="border-gray-300 md:hidden" />

        {orgLoaderData?.organization ? (
          <MembersSidebar
            members={loaderData.members}
            params={params}
            organization={orgLoaderData.organization}
          />
        ) : undefined}
      </div>
      <hr className="border-gray-300 md:hidden" />
      {loaderData.databases.length ? (
        <div className="flex flex-col gap-3 md:gap-6">
          <h3 className="flex items-center gap-2 text-xl font-semibold text-gray-900 md:font-bold">
            <IconDatabase className="stroke-1.5 size-6" aria-hidden />
            Databases
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
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
                      to={`/orgs/${database.organization_slug}/databases/${database.slug}/explorer`}
                      iconLeft={
                        <IconDatabaseSearch className="stroke-1.5 size-4" />
                      }
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
      ) : undefined}
      {loaderData.hasMoreDatabases ? (
        <div className="flex items-center justify-center">
          <LinkButton
            to={`/orgs/${params.org_slug}/databases`}
            intent="secondary"
            space="sm"
          >
            More
          </LinkButton>
        </div>
      ) : undefined}
    </Article>
  );
}
