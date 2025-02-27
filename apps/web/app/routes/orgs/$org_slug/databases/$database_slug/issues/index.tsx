import { Form, useLoaderData, useParams, useSearchParams } from "react-router";
import { Button, LinkButton } from "~/components/button";

import type { LoaderFunctionArgs, MetaDescriptor } from "react-router";
import {
  getDefaultRequestHeaders,
  getUserOrServiceAccountHeaders,
} from "~/services/auth.server";

import { mergeHeaders } from "@sort/sdk";
import { IconSearch, IconTicket } from "@tabler/icons-react";
import { useState } from "react";
import { Article } from "~/components/article";
import { IssueListItem } from "~/components/issue-list-item";
import { client } from "~/sdk/client.server";
import { dataFnMiddleware } from "~/utils/request.server";
import { assertResponseParams, extractMessageOrThrow } from "~/utils/response";

export function meta() {
  return [
    {
      title: "Issues",
    },
  ] satisfies MetaDescriptor[];
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  assertResponseParams(params, ["org_slug", "database_slug"]);
  const headers = mergeHeaders(
    getDefaultRequestHeaders(request),
    await getUserOrServiceAccountHeaders(request),
  );

  const url = new URL(request.url);
  const searchParams = url.searchParams;

  const [
    {
      payload: { issues },
    },
    {
      payload: { members },
    },
  ] = await Promise.all([
    dataFnMiddleware(
      request,
      client.v2.searchIssues({
        headers,
        params,
        searchParams,
      }),
    ).then(extractMessageOrThrow("search_issues")),
    dataFnMiddleware(
      request,
      client.v2.listOrganizationMembers({
        headers,
        params,
      }),
    ).then(extractMessageOrThrow("list_organization_members")),
  ]);

  return { issues, members };
}

const getSearchFilter = (status: "open" | "closed", current: string) => {
  if (/status:\w+/.test(current)) {
    return current.replace(/status:\w+/g, `status:${status}`);
  }

  return `status:${status} ${current}`;
};

export default function Route() {
  const loaderData = useLoaderData<typeof loader>();
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultSearch = searchParams.get("q") ?? "";
  const [searchValue, setSearchValue] = useState(defaultSearch);

  return (
    <Article>
      <header className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xl font-semibold text-gray-900 md:font-bold">
          <IconTicket className="stroke-1.5 size-6" aria-hidden />
          Issues
        </h3>
        <LinkButton
          space="sm"
          to={`/orgs/${params.org_slug}/databases/${params.database_slug}/issues/new`}
          intent="secondary"
        >
          New Issue
        </LinkButton>
      </header>
      <Form id="search-issues" className="flex flex-col gap-3 md:gap-6">
        <div className="relative flex grow items-center justify-center">
          <IconSearch className="pointer-events-none absolute left-3 size-5 text-gray-600" />
          <input
            autoCapitalize="none"
            autoComplete="off"
            className="w-full rounded-lg border border-gray-300 py-2 pr-2 pl-10 font-medium text-gray-900 caret-blue-600 placeholder:font-normal placeholder:text-gray-600 focus:outline-2 focus:outline-offset-2 focus:outline-gray-900"
            name="q"
            onChange={(event) => setSearchValue(event.currentTarget.value)}
            placeholder="Search"
            type="search"
            value={searchValue}
          />
        </div>
      </Form>
      <div className="md:grow md:rounded-xl md:border md:border-gray-300">
        <div className="flex justify-between gap-2 py-3 md:rounded-t-xl md:border-b md:border-gray-300 md:bg-gray-50 md:px-10">
          <div>
            <div className="inline-flex items-center gap-2">
              <Button
                type="button"
                space="xs"
                intent="secondary"
                onClick={() => {
                  const newSearch = getSearchFilter("open", searchValue);
                  setSearchValue(newSearch);
                  setSearchParams((prev) => {
                    prev.set("q", newSearch);
                    return prev;
                  });
                }}
                aria-pressed={!/status:closed/.test(defaultSearch)}
              >
                Open
              </Button>
              <Button
                type="button"
                space="xs"
                intent="secondary"
                onClick={() => {
                  const newSearch = getSearchFilter("closed", searchValue);
                  setSearchValue(newSearch);
                  setSearchParams((prev) => {
                    prev.set("q", newSearch);
                    return prev;
                  });
                }}
                aria-pressed={/status:closed/.test(defaultSearch)}
              >
                Closed
              </Button>
            </div>
          </div>
          <div className="hidden text-gray-700 md:block">Assignees</div>
        </div>
        <div>
          {loaderData.issues.length ? (
            <ol className="-mx-4 divide-y divide-gray-300 md:mx-0 md:rounded-b-xl">
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
        </div>
      </div>
    </Article>
  );
}
