import { mergeHeaders } from "@sort/sdk";
import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { Article } from "~/components/article";
import { client } from "~/sdk/client.server";
import {
  getDefaultRequestHeaders,
  getUserOrServiceAccountHeaders,
} from "~/services/auth.server";
import { dataFnMiddleware } from "~/utils/request.server";
import { extractMessageOrThrow } from "~/utils/response";
import { getNonBlankStringOrDefault } from "~/utils/string";

export async function loader({ request }: LoaderFunctionArgs) {
  const headers = mergeHeaders(
    getDefaultRequestHeaders(request),
    await getUserOrServiceAccountHeaders(request),
  );

  const url = new URL(request.url);
  const q = url.searchParams.get("q");

  const {
    payload: { results },
  } = await dataFnMiddleware(
    request,
    client.v2.search({
      headers,
      searchParams: q
        ? new URLSearchParams({
            q,
          })
        : undefined,
    }),
  ).then(extractMessageOrThrow("search"));

  return {
    search: q ?? "",
    results,
  };
}

const resultClassName =
  "text-gray-900 group flex justify-between w-full items-center px-2 py-2 text-sm focus:bg-gray-200";
const resultLinkClassName = "hover:underline";

export default function Route() {
  const loaderData = useLoaderData<typeof loader>();

  return (
    <Article>
      <h2 className="text-3xl font-medium">Search</h2>
      <div className="flex flex-col gap-2">
        <ul id="results" className="flex flex-col gap-1 p-2">
          <li id="results-orgs" className="p-1">
            <h2 className="font-medium">Organizations</h2>
            <ul className="divide-y-2 divide-gray-100">
              {loaderData.results.organizations.map((org) => (
                <li key={org.org_slug} className={resultClassName}>
                  <Link
                    to={`/orgs/${org.org_slug}`}
                    className={resultLinkClassName}
                  >
                    {org.org_name}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
          <li id="results-dbs" className="p-1">
            <h2 className="font-medium">Databases</h2>
            <ul className="divide-y-2 divide-gray-100">
              {loaderData.results.databases.map((db) => (
                <li
                  key={`${db.connection_id}|${db.org_slug}|${db.db_name_raw}`}
                  className={resultClassName}
                >
                  <Link
                    to={`/orgs/${db.org_slug}/databases/${db.db_slug}`}
                    className={resultLinkClassName}
                  >
                    {db.org_name} /&nbsp;
                    {getNonBlankStringOrDefault(db.db_name, db.db_name_raw)}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
          <li id="results-tables" className="p-1">
            <h2 className="font-medium">Tables</h2>
            <ul className="divide-y-2 divide-gray-100">
              {loaderData.results.tables.map((table) => (
                <li
                  key={`${table.connection_id}|${table.org_slug}|${table.db_name_raw}|${table.schema_name_raw}|${table.table_name_raw}`}
                  className={resultClassName}
                >
                  <Link
                    to={`/orgs/${table.org_slug}/databases/${table.db_slug}/explorer/schemas/${table.schema_name_raw}/tables/${getNonBlankStringOrDefault(
                      table.table_name,
                      table.table_name_raw,
                    )}`}
                    className={resultLinkClassName}
                  >
                    {table.org_name} / {table.connection_name} /&nbsp;
                    {getNonBlankStringOrDefault(
                      table.db_name,
                      table.db_name_raw,
                    )}
                    &nbsp;/&nbsp;
                    {getNonBlankStringOrDefault(
                      table.schema_name,
                      table.schema_name_raw,
                    )}
                    &nbsp;/&nbsp;
                    {getNonBlankStringOrDefault(
                      table.table_name,
                      table.table_name_raw,
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        </ul>
      </div>
    </Article>
  );
}
