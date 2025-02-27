import { mergeHeaders } from "@sort/sdk";
import { IconLabel } from "@tabler/icons-react";
import type { LoaderFunctionArgs, MetaDescriptor } from "react-router";
import {
  Link,
  useLoaderData,
  useParams,
  useRouteLoaderData,
} from "react-router";
import { Article } from "~/components/article";
import { LinkButton } from "~/components/button";
import type { loader as orgLoader } from "~/routes/orgs/$org_slug";
import { client } from "~/sdk/client.server";
import {
  getDefaultRequestHeaders,
  getUserOrServiceAccountHeaders,
} from "~/services/auth.server";
import { getTextColor } from "~/utils/color";
import { dataFnMiddleware } from "~/utils/request.server";
import { assertResponseParams, extractMessageOrThrow } from "~/utils/response";

export function meta() {
  return [
    {
      title: "Labels",
    },
  ] satisfies MetaDescriptor[];
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  assertResponseParams(params, ["org_slug", "database_slug"]);
  const headers = mergeHeaders(
    getDefaultRequestHeaders(request),
    await getUserOrServiceAccountHeaders(request),
  );

  const {
    payload: { labels },
  } = await dataFnMiddleware(
    request,
    client.v2.listDatabaseLabels({
      headers,
      params,
    }),
  ).then(extractMessageOrThrow("list_database_labels"));

  return { labels };
}

export default function Route() {
  const orgLoaderData = useRouteLoaderData<typeof orgLoader>(
    "routes/orgs/$org_slug",
  );
  const loaderData = useLoaderData<typeof loader>();
  const params = useParams();

  return (
    <Article>
      <header className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xl font-semibold text-gray-900 md:font-bold">
          <IconLabel className="stroke-1.5 size-6" aria-hidden />
          Labels
        </h3>
        {orgLoaderData?.organization.permissions?.is_member.value ? (
          <LinkButton
            space="sm"
            intent="secondary"
            to={`/orgs/${params.org_slug}/databases/${params.database_slug}/labels/new`}
          >
            New Label
          </LinkButton>
        ) : undefined}
      </header>
      <div className="space-y-6 sm:space-y-4">
        {loaderData.labels.length ? (
          loaderData.labels.map((label) => (
            <div key={label.id} className="flex">
              <div className="flex w-full flex-wrap items-baseline gap-2">
                <div className="sm:w-fit sm:min-w-40">
                  {orgLoaderData?.organization.permissions?.is_member.value ? (
                    <Link
                      to={`/orgs/${params.org_slug}/databases/${params.database_slug}/labels/${label.id}/edit`}
                      className="inline-flex rounded-sm border border-gray-200 px-2 py-1 text-sm"
                      style={{
                        backgroundColor: label.color,
                        color: getTextColor(label.color),
                      }}
                    >
                      {label.name}
                    </Link>
                  ) : (
                    <span
                      className="inline-flex rounded-sm border border-gray-200 px-2 py-1 text-sm"
                      style={{
                        backgroundColor: label.color,
                        color: getTextColor(label.color),
                      }}
                    >
                      {label.name}
                    </span>
                  )}
                </div>
                {label.description ? (
                  <p className="text-sm text-gray-600">{label.description}</p>
                ) : (
                  <p className="text-sm text-gray-600 italic">
                    empty description
                  </p>
                )}
              </div>
              <div>
                {orgLoaderData?.organization.permissions?.is_member.value ? (
                  <LinkButton
                    intent="secondary"
                    space="sm"
                    to={`/orgs/${params.org_slug}/databases/${params.database_slug}/labels/${label.id}/edit`}
                  >
                    Edit
                  </LinkButton>
                ) : undefined}
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-blue-100 px-4 py-8">
            <h2 className="text-center font-medium text-gray-900">
              No Labels Found
            </h2>
            {orgLoaderData?.organization.permissions?.is_member.value ? (
              <>
                <p className="text-center text-sm text-gray-700">
                  Create a label to help organize your issues. Labels can be
                  used to categorize issues, or change requests based on
                  descriptive titles, such as{" "}
                  <strong className="font-semibold">bug</strong>,{" "}
                  <strong className="font-semibold">enhancement</strong>, or{" "}
                  <strong className="font-semibold">feature request</strong>.
                </p>
                <LinkButton
                  to={`/orgs/${params.org_slug}/databases/${params.database_slug}/labels/new`}
                >
                  New Label
                </LinkButton>
              </>
            ) : undefined}
          </div>
        )}
      </div>
    </Article>
  );
}
