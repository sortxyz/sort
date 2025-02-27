import { mergeHeaders } from "@sort/sdk";
import {
  IconDatabaseSearch,
  IconGitPullRequest,
  IconReportSearch,
  IconTicket,
} from "@tabler/icons-react";
import type {
  LoaderFunctionArgs,
  MetaArgs,
  MetaDescriptor,
} from "react-router";
import {
  Link,
  useLoaderData,
  useParams,
  useRouteLoaderData,
} from "react-router";
import { Article } from "~/components/article";
import { LinkButton } from "~/components/button";
import { ChangeRequestListItem } from "~/components/change-request-list-item";
import { IssueListItem } from "~/components/issue-list-item";
import { Markdown } from "~/components/markdown";
import { MembersSidebar } from "~/components/members-sidebar";
import { QueryCard } from "~/components/query-card";
import type { loader as orgLoader } from "~/routes/orgs/$org_slug";
import type { loader as databaseLoader } from "~/routes/orgs/$org_slug/databases/$database_slug";
import { client } from "~/sdk/client.server";
import {
  getDefaultRequestHeaders,
  getUserOrServiceAccountHeaders,
} from "~/services/auth.server";
import { dataFnMiddleware } from "~/utils/request.server";
import { assertResponseParams, extractMessageOrThrow } from "~/utils/response";

export function meta({
  matches,
}: MetaArgs<
  never,
  {
    "routes/orgs/$org_slug/databases/$database_slug": typeof databaseLoader;
  }
>) {
  const match = matches.find(
    (match) => match.id === "routes/orgs/$org_slug/databases/$database_slug",
  );

  const title =
    match?.data.database.display_name ??
    match?.data.database.raw_name ??
    "Database";

  return [
    {
      title,
    },
  ] satisfies MetaDescriptor[];
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  assertResponseParams(params, ["org_slug", "database_slug"]);
  const headers = mergeHeaders(
    getDefaultRequestHeaders(request),
    await getUserOrServiceAccountHeaders(request),
  );

  const [
    {
      payload: { members },
    },
    {
      payload: { queries },
    },
    {
      payload: { issues },
    },
    {
      payload: { change_requests },
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
      client.v2.listQueries({
        headers,
        params,
        searchParams: new URLSearchParams({
          database_slug: params.database_slug,
        }),
      }),
    ).then(extractMessageOrThrow("list_queries")),
    dataFnMiddleware(
      request,
      client.v2.searchIssues({
        headers,
        params,
        searchParams: new URLSearchParams({ limit: "5" }),
      }),
    ).then(extractMessageOrThrow("search_issues")),
    dataFnMiddleware(
      request,
      client.v2.searchChangeRequests({
        headers,
        params,
        searchParams: new URLSearchParams({ limit: "6" }),
      }),
    ).then(extractMessageOrThrow("search_change_requests")),
  ]);

  return {
    members,
    queries: queries.slice(0, 4),
    issues: issues.slice(0, 4),
    change_requests: change_requests.slice(0, 5),
    has_more_queries: queries.length > 4,
    has_more_issues: issues.length > 4,
    has_more_change_requests: change_requests.length > 5,
  };
}

export default function Route() {
  const orgLoaderData = useRouteLoaderData<typeof orgLoader>(
    "routes/orgs/$org_slug",
  );
  const databaseLoaderData = useRouteLoaderData<typeof databaseLoader>(
    "routes/orgs/$org_slug/databases/$database_slug",
  );
  const loaderData = useLoaderData<typeof loader>();
  const params = useParams();

  return (
    <Article>
      <div className="flex flex-col justify-center gap-4 md:flex-row">
        <div className="grow rounded-lg border border-gray-300">
          <header className="flex items-center justify-between rounded-t-lg bg-gray-100 px-5 py-2">
            <h3 className="text-sm/6 font-semibold text-gray-900">
              {databaseLoaderData?.database.display_name}
            </h3>
            <div className="inline-flex items-center gap-2">
              <LinkButton
                iconLeft={
                  <IconDatabaseSearch className="stroke-1.5 size-3.5" />
                }
                space="xs"
                to={`/orgs/${params.org_slug}/databases/${params.database_slug}/explorer`}
              >
                Explore
              </LinkButton>
              {orgLoaderData?.organization?.permissions?.is_owner.value ? (
                <LinkButton
                  to={`/orgs/${params.org_slug}/databases/${params.database_slug}/edit`}
                  space="xs"
                  intent="secondary"
                >
                  Edit
                </LinkButton>
              ) : undefined}
            </div>
          </header>
          {databaseLoaderData?.database.description ? (
            <div className="prose prose-sm p-5">
              <Markdown>{databaseLoaderData.database.description}</Markdown>
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
      {loaderData.queries.length ? (
        <div className="flex flex-col gap-3 md:gap-6">
          <h3 className="flex items-center gap-2 text-xl font-semibold text-gray-900 md:font-bold">
            <IconReportSearch className="stroke-1.5 size-6" aria-hidden />
            Queries
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
            {loaderData.queries.map((query) => (
              <QueryCard
                key={query.id}
                buttonGroup={
                  <div className="inline-flex items-center gap-2">
                    <LinkButton
                      to={`/orgs/${query.org_slug}/databases/${query.database_slug}/explorer/queries/${query.id}`}
                      intent="secondary"
                      iconLeft={
                        <IconDatabaseSearch className="stroke-1.5 size-6" />
                      }
                    >
                      Explore
                    </LinkButton>
                  </div>
                }
                cta={
                  <Link
                    to={`/orgs/${query.org_slug}/databases/${query.database_slug}/explorer/queries/${query.id}`}
                  >
                    {query.name}
                  </Link>
                }
                author={{
                  name: query.created_by_name,
                  picture: query.created_by_picture,
                  username: query.created_by_username,
                }}
                lastUpdatedAt={query.updated_at}
                summary={query.description}
              />
            ))}
          </div>
        </div>
      ) : undefined}
      {loaderData.has_more_queries ? (
        <div className="flex items-center justify-center">
          <LinkButton
            to={`/orgs/${params.org_slug}/databases/${params.database_slug}/explorer/queries`}
            intent="secondary"
            space="sm"
          >
            More
          </LinkButton>
        </div>
      ) : undefined}
      <div className="flex flex-col gap-4">
        <h3 className="flex items-center gap-2 text-xl font-semibold text-gray-900 md:font-bold">
          <IconTicket className="stroke-1.5 size-6" aria-hidden />
          Issues
        </h3>
        {loaderData.issues.length ? (
          <ol className="-mx-4 divide-y divide-gray-300 md:-mx-8">
            {loaderData.issues.map((issue) => (
              <IssueListItem
                database_slug={params.database_slug!}
                issue={issue}
                key={issue.id}
                members={loaderData.members}
                org_slug={params.org_slug!}
              />
            ))}
          </ol>
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-blue-100 px-4 py-8">
            <h2 className="text-center font-medium text-gray-900">
              No Issues Found
            </h2>
            <p className="text-center text-sm text-gray-700">
              Create an issue to ask for help with a database query, point out
              incorrect data, or ask for additional data to be added.
            </p>
            <LinkButton
              to={`/orgs/${params.org_slug}/databases/${params.database_slug}/issues/new`}
            >
              New Issue
            </LinkButton>
          </div>
        )}
        {loaderData.has_more_issues ? (
          <div className="flex items-center justify-center">
            <LinkButton
              to={`/orgs/${params.org_slug}/databases/${params.database_slug}/issues`}
              intent="secondary"
              space="sm"
            >
              More
            </LinkButton>
          </div>
        ) : undefined}
      </div>
      {databaseLoaderData?.connection.data_provider !== "postgres" ? (
        <div className="flex flex-col gap-4 rounded-lg border border-dashed border-blue-100 px-4 py-8">
          <h2 className="text-center font-medium text-gray-900">
            Change Requests are not supported for this database
          </h2>
          <p className="text-center text-sm text-gray-700">
            Change Requests are only supported for PostgreSQL databases at this
            time.
          </p>
        </div>
      ) : (
        <>
          <h3 className="flex items-center gap-2 text-xl font-semibold text-gray-900 md:font-bold">
            <IconGitPullRequest className="stroke-1.5 size-6" aria-hidden />
            Change Requests
          </h3>
          {loaderData.change_requests.length ? (
            <ol className="-mx-4 divide-y divide-gray-300 md:-mx-8">
              {loaderData.change_requests.map((changeRequest) => (
                <ChangeRequestListItem
                  changeRequest={changeRequest}
                  database_slug={params.database_slug!}
                  key={changeRequest.id}
                  members={loaderData.members}
                  org_slug={params.org_slug!}
                />
              ))}
            </ol>
          ) : (
            <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-blue-100 px-4 py-8">
              <h2 className="text-center font-medium text-gray-900">
                No Change Requests found
              </h2>
              <p className="text-center text-sm text-gray-700">
                Create a change request from the Data Explorer to update the
                data in this database.
              </p>
              <LinkButton
                to={`/orgs/${params.org_slug}/databases/${params.database_slug}/explorer`}
              >
                Visit Data Explorer
              </LinkButton>
            </div>
          )}
          {loaderData.has_more_change_requests ? (
            <div className="flex items-center justify-center">
              <LinkButton
                to={`/orgs/${params.org_slug}/databases/${params.database_slug}/change-requests`}
                intent="secondary"
                space="sm"
              >
                More
              </LinkButton>
            </div>
          ) : undefined}
        </>
      )}
    </Article>
  );
}
