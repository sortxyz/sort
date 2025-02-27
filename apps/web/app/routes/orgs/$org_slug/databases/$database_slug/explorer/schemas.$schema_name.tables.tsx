import type { V2 } from "@sort/sdk";
import { mergeHeaders } from "@sort/sdk";
import {
  IconChevronLeft,
  IconDatabaseSearch,
  IconSearch,
  IconTable,
} from "@tabler/icons-react";
import clsx from "clsx";
import { useContext, useId } from "react";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  ShouldRevalidateFunctionArgs,
} from "react-router";
import {
  Form,
  NavLink,
  Outlet,
  redirect,
  redirectDocument,
  useParams,
  useRouteLoaderData,
  useSearchParams,
} from "react-router";
import { ActionForm } from "~/components/action-form";
import { Button } from "~/components/button";
import { Field, FieldInput, FieldLabel, FieldSelect } from "~/components/field";
import {
  GlobalSidebarMenu,
  GlobalSidebarMenuNavLinkItem,
} from "~/components/global-sidebar";
import { GlobalSidebarCollapsedContext } from "~/components/global-sidebar/global-sidebar-collapsed-context";
import { Spinner } from "~/components/spinner";
import type { loader as databaseLoader } from "~/routes/orgs/$org_slug/databases/$database_slug";
import { client } from "~/sdk/client.server";
import {
  getDefaultRequestHeaders,
  getUserOrServiceAccountHeaders,
} from "~/services/auth.server";
import { validateCsrf } from "~/utils/csrf.server";
import { setFlashHeaders, setFlashHeadersFromRequest } from "~/utils/flash";
import { dataFnMiddleware } from "~/utils/request.server";
import { assertResponseParams, extractMessageOrThrow } from "~/utils/response";

async function getTables({
  request,
  params,
  searchParams,
  headers,
  context,
}: {
  request: Request;
  params: Record<"org_slug" | "database_slug" | "schema_name", string>;
  searchParams: URLSearchParams;
  headers: HeadersInit;
  context: Record<"database_name", string>;
}): Promise<V2.Table[]> {
  const tableQuery = searchParams.get("search-tables") ?? "";

  if (tableQuery.trim().length) {
    const q = `org:${params.org_slug} schema:${params.schema_name} db:${context.database_name} ${tableQuery}`;

    const {
      payload: { results },
    } = await dataFnMiddleware(
      request,
      client.v2.search({
        headers,
        searchParams: new URLSearchParams({
          q,
          limit: "100",
        }),
      }),
    ).then(extractMessageOrThrow("search"));

    return results.tables.map((table) => {
      return {
        id: table.table_name,
        name: table.table_name,
      };
    });
  }

  const {
    payload: { tables },
  } = await dataFnMiddleware(
    request,
    client.v2.listSchemaTables({
      headers,
      params,
    }),
  ).then(extractMessageOrThrow("list_schema_tables"));

  return tables.map((table) => {
    return {
      ...table,
      id: table.name,
    };
  });
}

function Menu() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  searchParams.delete("where");

  const loaderData = useRouteLoaderData<typeof loader>(
    "routes/orgs/$org_slug/databases/$database_slug/explorer/schemas.$schema_name.tables",
  );
  const databaseLoaderData = useRouteLoaderData<typeof databaseLoader>(
    "routes/orgs/$org_slug/databases/$database_slug",
  );
  const collapsed = useContext(GlobalSidebarCollapsedContext);
  const schemaId = useId();

  return (
    <GlobalSidebarMenu>
      {databaseLoaderData ? (
        <GlobalSidebarMenuNavLinkItem
          end
          iconLeft={<IconChevronLeft className="stroke-1.5 size-6" />}
          title={
            databaseLoaderData.database.display_name ??
            databaseLoaderData.database.raw_name
          }
          to={`/orgs/${params.org_slug}/databases/${params.database_slug}`}
        >
          {databaseLoaderData.database.display_name ??
            databaseLoaderData.database.raw_name}
        </GlobalSidebarMenuNavLinkItem>
      ) : undefined}
      <GlobalSidebarMenuNavLinkItem
        iconLeft={<IconDatabaseSearch className="stroke-1.5 size-6" />}
        title="Data Explorer"
        to={`/orgs/${params.org_slug}/databases/${params.database_slug}/explorer/schemas/${params.schema_name}/tables/${params.table_name}`}
      >
        Data Explorer
      </GlobalSidebarMenuNavLinkItem>
      <header
        className={clsx("sticky top-0 flex-col gap-2", {
          "flex lg:hidden": collapsed,
          flex: !collapsed,
        })}
      >
        <nav className="flex items-center rounded-lg border border-gray-300 bg-gray-200 p-1">
          <NavLink
            to={
              params.table_name
                ? `/orgs/${params.org_slug}/databases/${params.database_slug}/explorer/schemas/${params.schema_name}/tables/${params.table_name}`
                : `/orgs/${params.org_slug}/databases/${params.database_slug}/explorer/schemas/${params.schema_name}/tables`
            }
            className="grow cursor-pointer rounded-lg py-1 text-center text-sm text-gray-900 shadow-xs aria-current-page:bg-white"
          >
            Tables
          </NavLink>
          <NavLink
            to={{
              pathname: `/orgs/${params.org_slug}/databases/${params.database_slug}/explorer/queries`,
              search: new URLSearchParams({
                schema_name: params.schema_name!,
              }).toString(),
            }}
            className="grow cursor-pointer rounded-lg py-1 text-center text-sm text-gray-900 shadow-xs aria-current-page:bg-white"
          >
            Queries
          </NavLink>
        </nav>
        <Form
          action={`/orgs/${params.org_slug}/databases/${params.database_slug}/explorer/schemas/${params.schema_name}/tables/${params.table_name}`}
        >
          <Field fullWidth>
            <FieldInput
              autoCapitalize="none"
              autoComplete="off"
              iconLeft={
                <IconSearch className="stroke-1.5 size-4 text-gray-600" />
              }
              name="search-tables"
              placeholder="Search Tables"
              type="search"
            />
          </Field>
        </Form>
      </header>
      <ul
        className={clsx("grow flex-col gap-2 overflow-y-auto p-4 md:px-0", {
          "flex lg:hidden": collapsed,
          flex: !collapsed,
        })}
      >
        {!loaderData?.tables.length ? (
          <li className="block">
            <span className="block truncate px-4 py-2 text-lg">
              No results found
            </span>
          </li>
        ) : undefined}
        {loaderData?.tables.map((table) => (
          <li className="block" key={table.id}>
            <NavLink
              to={`/orgs/${params.org_slug}/databases/${params.database_slug}/explorer/schemas/${params.schema_name}/tables/${table.name}`}
              className={clsx(
                "flex cursor-pointer items-center gap-2 truncate rounded-sm p-1 px-1.5 text-xs font-medium tracking-wide aria-current-page:bg-blue-600 aria-current-page:text-white",
              )}
            >
              {(props) => (
                <>
                  <span>
                    {props.isPending || props.isTransitioning ? (
                      <Spinner className="size-5 animate-spin" />
                    ) : (
                      <IconTable className="stroke-1.5 size-5" />
                    )}
                  </span>
                  <span>{table.name}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>

      {loaderData?.schemas && loaderData.schemas.length > 1 ? (
        <ActionForm
          className={clsx("sticky bottom-0 bg-inherit pt-2", {
            "lg:hidden": collapsed,
          })}
          action={`/orgs/${params.org_slug}/databases/${params.database_slug}/explorer/schemas/${params.schema_name}/tables`}
        >
          <Field
            fullWidth
            label={<FieldLabel htmlFor={schemaId}>Schema</FieldLabel>}
          >
            <FieldSelect
              id={schemaId}
              name="schema_name"
              value={params.schema_name}
              onChange={(event) => {
                event.currentTarget.form?.submit();
              }}
            >
              {loaderData?.schemas.map((schema) => (
                <option key={schema.id} value={schema.name}>
                  {schema.name}
                </option>
              ))}
            </FieldSelect>
          </Field>

          <input type="hidden" name="intent" value="change-schema" />
          <noscript>
            <Button type="submit">Change Schema</Button>
          </noscript>
        </ActionForm>
      ) : undefined}
    </GlobalSidebarMenu>
  );
}

export const handle = {
  hideFooter: true,
  menu: <Menu />,
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  assertResponseParams(params, ["org_slug", "database_slug", "schema_name"]);

  const url = new URL(request.url);
  const headers = mergeHeaders(
    getDefaultRequestHeaders(request),
    await getUserOrServiceAccountHeaders(request),
  );
  const {
    payload: { database },
  } = await dataFnMiddleware(
    request,
    client.v2.getDatabase({
      headers,
      params,
    }),
  ).then(extractMessageOrThrow("get_database"));
  const [
    {
      payload: { schemas },
    },
    tables,
  ] = await Promise.all([
    dataFnMiddleware(
      request,
      client.v2.listDatabaseSchemas({
        headers,
        params,
      }),
    ).then(extractMessageOrThrow("list_database_schemas")),
    getTables({
      request,
      headers,
      params,
      searchParams: url.searchParams,
      context: {
        database_name: database.raw_name,
      },
    }),
  ]);

  const firstTable = tables[0];

  if (
    !firstTable &&
    !params.table_name &&
    !url.searchParams.has("search-tables")
  ) {
    throw redirectDocument(
      `/orgs/${params.org_slug}/databases/${params.database_slug}`,
      {
        headers: await setFlashHeaders({
          type: "error",
          message: "No tables found",
        }),
      },
    );
  } else if (
    !firstTable &&
    !params.table_name &&
    url.searchParams.has("search-tables")
  ) {
    throw redirectDocument(
      `/orgs/${params.org_slug}/databases/${params.database_slug}`,
      {
        headers: await setFlashHeaders({
          type: "error",
          message: "No tables found",
        }),
      },
    );
  } else if (
    firstTable &&
    (!params.table_name || url.searchParams.get("search-tables"))
  ) {
    throw redirectDocument(
      `/orgs/${params.org_slug}/databases/${params.database_slug}/explorer/schemas/${params.schema_name}/tables/${firstTable.name}`,
      {
        headers: await setFlashHeadersFromRequest(request),
      },
    );
  }

  return { schemas, tables };
}

export async function action({ request, params }: ActionFunctionArgs) {
  assertResponseParams(params, ["org_slug", "database_slug", "schema_name"]);
  const formData = await request.formData();
  await validateCsrf(formData, request.headers);
  const intent = formData.get("intent");

  switch (intent) {
    case "change-schema": {
      const schema_name = formData.get("schema_name");
      if (typeof schema_name !== "string") {
        throw redirect(
          `/orgs/${params.org_slug}/databases/${params.database_slug}/explorer/schemas/${params.schema_name}/tables`,
        );
      }

      throw redirectDocument(
        `/orgs/${params.org_slug}/databases/${params.database_slug}/explorer/schemas/${schema_name}/tables`,
      );
    }
    default: {
      throw new Response("Bad Request", {
        status: 400,
      });
    }
  }
}

export function shouldRevalidate({
  currentParams,
  nextParams,
  currentUrl,
  nextUrl,
}: ShouldRevalidateFunctionArgs) {
  const currentQs = new URL(currentUrl).searchParams;
  const nextQs = new URL(nextUrl).searchParams;
  return (
    currentParams.schema_name !== nextParams.schema_name ||
    currentQs.get("search-tables") !== nextQs.get("search-tables")
  );
}

export default function Route() {
  return <Outlet />;
}
