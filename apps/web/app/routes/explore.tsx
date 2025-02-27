import { mergeHeaders } from "@sort/sdk";
import { IconDatabase, IconReportSearch } from "@tabler/icons-react";
import type {
  HeadersArgs,
  LoaderFunctionArgs,
  MetaDescriptor,
} from "react-router";
import { data, Link, useLoaderData } from "react-router";
import { LinkButton } from "~/components/button";
import { DatabaseCard } from "~/components/database-card";
import { QueryCard } from "~/components/query-card";
import { Tag } from "~/components/tag";
import { dataFnMiddleware } from "~/utils/request.server";
import { extractMessageOrThrow } from "~/utils/response";

import { Article } from "~/components/article";
import { client } from "~/sdk/client.server";
import {
  getDefaultRequestHeaders,
  getServiceAccountHeaders,
} from "~/services/auth.server";
import { serverEnv } from "~/utils/env.server";

export function meta() {
  return [
    { title: "Latest Public Databases and Queries on Sort" },
    {
      description:
        "Latest public databases and queries from the community on Sort.",
    },
  ] satisfies MetaDescriptor[];
}

const CACHE_TIME = serverEnv.NODE_ENV === "production" ? 3600 : 0;

const CACHE_CONTROL = `public, max-age=${CACHE_TIME}, s-maxage=${CACHE_TIME}, stale-while-revalidate=${CACHE_TIME}, stale-if-error=${CACHE_TIME}`;

export async function loader({ request }: LoaderFunctionArgs) {
  const headers = mergeHeaders(
    getDefaultRequestHeaders(request),
    getServiceAccountHeaders(),
  );
  const {
    payload: { databases, queries },
  } = await dataFnMiddleware(
    request,
    client.v2.getHomePageData({
      headers,
    }),
  ).then(extractMessageOrThrow("get_home_page_data"));

  return data(
    {
      databases,
      queries,
    },
    {
      headers: {
        "Cache-Control": CACHE_CONTROL,
      },
    },
  );
}

export function headers({ loaderHeaders }: HeadersArgs) {
  return {
    "Cache-Control": loaderHeaders.get("Cache-Control") ?? CACHE_CONTROL,
  };
}

export default function Route() {
  const loaderData = useLoaderData<typeof loader>();

  return (
    <Article>
      <header className="flex flex-col items-center gap-6 pb-6 text-center">
        <h2 className="text-3xl font-bold lg:text-4xl">
          Explore Latest Public Databases
        </h2>
        <p className="text-gray-700 sm:text-xl">
          Latest public databases and queries from the community
        </p>
      </header>

      <div>
        <div>
          <header className="mb-8">
            <h3 className="flex items-center gap-2 text-xl font-semibold text-gray-900 md:font-bold">
              <IconDatabase className="stroke-1.5 size-6" aria-hidden />
              Public Databases
            </h3>
          </header>
          <div className="grid gap-10 md:grid-cols-1">
            {loaderData.databases.length ? (
              <div className="grid grow grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 md:p-0 xl:grid-cols-3">
                {loaderData.databases.map((database) => (
                  <DatabaseCard
                    key={database.db_slug}
                    cta={
                      <Link
                        to={`/orgs/${database.org_slug}/databases/${database.db_slug}`}
                      >
                        {database.db_display_name}
                      </Link>
                    }
                    rawName={database.db_real_name}
                    summary={database.db_summary}
                    orgName={database.org_slug}
                    tags={[database.data_provider].map((tag) => (
                      <Tag intent="neutral" key={tag}>
                        {tag}
                      </Tag>
                    ))}
                    buttonGroup={
                      <div className="inline-flex items-center gap-2">
                        <LinkButton
                          to={`/orgs/${database.org_slug}/databases/${database.db_slug}`}
                          intent="secondary"
                        >
                          Overview
                        </LinkButton>
                      </div>
                    }
                  />
                ))}
              </div>
            ) : undefined}
          </div>
        </div>

        <div>
          <header className="mt-12 mb-8">
            <h3 className="flex items-center gap-2 text-xl font-semibold text-gray-900 md:font-bold">
              <IconReportSearch className="stroke-1.5 size-6" aria-hidden />
              Public Queries
            </h3>
          </header>
          {loaderData.queries.length ? (
            <div className="grid grow grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 md:p-0 xl:grid-cols-3">
              {loaderData.queries.map((query) => (
                <QueryCard
                  buttonGroup={
                    <div className="inline-flex items-center gap-2">
                      <LinkButton
                        to={`/orgs/${query.org_slug}/databases/${query.db_slug}/explorer/queries/${query.query_id}`}
                        intent="secondary"
                        iconLeft={
                          <IconReportSearch className="stroke-1.5 size-4" />
                        }
                      >
                        Explore
                      </LinkButton>
                    </div>
                  }
                  key={query.query_id}
                  databaseName={query.db_display_name}
                  lastUpdatedAt={query.updated_at}
                  cta={
                    <Link
                      to={`/orgs/${query.org_slug}/databases/${query.db_slug}/explorer/queries/${query.query_id}`}
                    >
                      {query.query_name}
                    </Link>
                  }
                  summary={query.query_description}
                  tags={[query.connection_data_provider].map((tag) => (
                    <Tag intent="neutral" key={tag}>
                      {tag}
                    </Tag>
                  ))}
                />
              ))}
            </div>
          ) : undefined}
        </div>
      </div>
    </Article>
  );
}
