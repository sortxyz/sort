import { mergeHeaders } from "@sort/sdk";
import { IconGitPullRequest, IconSearch } from "@tabler/icons-react";
import { useState } from "react";
import type { LoaderFunctionArgs, MetaDescriptor } from "react-router";
import {
  Form,
  useLoaderData,
  useParams,
  useRouteLoaderData,
  useSearchParams,
} from "react-router";
import { Article } from "~/components/article";
import { Button, LinkButton } from "~/components/button";
import { ChangeRequestListItem } from "~/components/change-request-list-item";
import type { loader as databaseLoader } from "~/routes/orgs/$org_slug/databases/$database_slug";
import { client } from "~/sdk/client.server";
import {
  getDefaultRequestHeaders,
  getUserOrServiceAccountHeaders,
} from "~/services/auth.server";
import { getFlags } from "~/services/flags.server";
import { dataFnMiddleware } from "~/utils/request.server";
import {
  assertResponse,
  assertResponseParams,
  extractMessageOrThrow,
} from "~/utils/response";

export function meta() {
  return [
    {
      title: "Change Requests",
    },
  ] satisfies MetaDescriptor[];
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const flags = await getFlags(request);
  assertResponse(flags.changeRequests, "Not Found", { status: 404 });

  assertResponseParams(params, ["org_slug", "database_slug"]);

  const headers = mergeHeaders(
    getDefaultRequestHeaders(request),
    await getUserOrServiceAccountHeaders(request),
  );

  const url = new URL(request.url);
  const searchParams = url.searchParams;

  const [
    {
      payload: { change_requests },
    },
    {
      payload: { members },
    },
  ] = await Promise.all([
    dataFnMiddleware(
      request,
      client.v2.searchChangeRequests({
        headers,
        params,
        searchParams,
      }),
    ).then(extractMessageOrThrow("search_change_requests")),
    dataFnMiddleware(
      request,
      client.v2.listOrganizationMembers({
        headers,
        params,
      }),
    ).then(extractMessageOrThrow("list_organization_members")),
  ]);

  return {
    change_requests,
    members,
  };
}

const getSearchFilter = (status: "open" | "closed", current: string) => {
  if (/status:\w+/.test(current)) {
    return current.replace(/status:\w+/g, `status:${status}`);
  }

  return `status:${status} ${current}`;
};

export default function Route() {
  const databaseLoaderData = useRouteLoaderData<typeof databaseLoader>(
    "routes/orgs/$org_slug/databases/$database_slug",
  );
  const loaderData = useLoaderData<typeof loader>();
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultSearch = searchParams.get("q") ?? "";
  const [searchValue, setSearchValue] = useState(defaultSearch);

  return (
    <Article>
      <header className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xl font-semibold text-gray-900 md:font-bold">
          <IconGitPullRequest className="stroke-1.5 size-6" aria-hidden />
          Change Requests
        </h3>
      </header>
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
          <div className="space-y-4">
            <Form id="search-issues" className="flex flex-col gap-3 md:gap-6">
              <div className="relative flex grow items-center justify-center">
                <IconSearch className="pointer-events-none absolute left-3 size-5 text-gray-600" />
                <input
                  autoCapitalize="none"
                  autoComplete="off"
                  className="w-full rounded-lg border border-gray-300 py-2 pr-2 pl-10 font-medium text-gray-900 caret-blue-500 placeholder:font-normal placeholder:text-gray-600 focus:outline-2 focus:outline-offset-2 focus:outline-gray-900"
                  name="q"
                  onChange={(event) =>
                    setSearchValue(event.currentTarget.value)
                  }
                  placeholder="Search"
                  type="search"
                  value={searchValue}
                />
              </div>
            </Form>
          </div>

          <div className="space-y-4">
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
                        const newSearch = getSearchFilter(
                          "closed",
                          searchValue,
                        );
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
                <div className="hidden text-gray-700 md:block">Reviewers</div>
              </div>
              <div>
                {loaderData.change_requests.length ? (
                  <ol className="-mx-4 divide-y divide-gray-300 md:mx-0 md:rounded-b-xl">
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
                      Create a change request from the Data Explorer to update
                      the data in this database.
                    </p>
                    <LinkButton
                      to={`/orgs/${params.org_slug}/databases/${params.database_slug}/explorer`}
                    >
                      Visit Data Explorer
                    </LinkButton>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </Article>
  );
}
