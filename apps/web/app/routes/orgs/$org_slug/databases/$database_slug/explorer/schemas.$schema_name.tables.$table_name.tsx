import { parseWithZod } from "@conform-to/zod";
import { mergeHeaders } from "@sort/sdk";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaArgs,
  MetaDescriptor,
  ShouldRevalidateFunction,
  UIMatch,
} from "react-router";
import {
  redirect,
  useActionData,
  useLoaderData,
  useParams,
} from "react-router";
import { z } from "zod";
import { BreadcrumbNavLink } from "~/components/breadcrumb-nav";
import { DataExplorerTable } from "~/features/data-explorer/components";
import {
  buildFullColumn,
  getFullColumn,
  INTENTS,
  recordToColumnStringArray,
  schema,
} from "~/features/data-explorer/utils";
import { buildRunQueryIntentSchema, getFilterColumnDef } from "~/schemas/query";
import { client } from "~/sdk/client.server";
import {
  getDefaultRequestHeaders,
  getOptionalUser,
  getUserOrServiceAccountHeaders,
} from "~/services/auth.server";
import { getFlags } from "~/services/flags.server";
import { validateCsrf } from "~/utils/csrf.server";
import { assertKeys } from "~/utils/error";
import { setFlashHeaders } from "~/utils/flash";
import {
  errorMessageToReplyOptions,
  generalErrorMessage,
} from "~/utils/message";
import { dataFnMiddleware } from "~/utils/request.server";
import { assertResponseParams, extractMessageOrThrow } from "~/utils/response";

export const handle = {
  breadcrumb(match: UIMatch) {
    return (
      <BreadcrumbNavLink end to={match.pathname}>
        {match.params.table_name}
      </BreadcrumbNavLink>
    );
  },
};

export function meta({ params }: MetaArgs) {
  assertKeys(params, [
    "org_slug",
    "database_slug",
    "schema_name",
    "table_name",
  ]);
  return [
    { title: `${params.database_slug} / ${params.table_name}` },
  ] satisfies MetaDescriptor[];
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  assertResponseParams(params, [
    "org_slug",
    "database_slug",
    "schema_name",
    "table_name",
  ]);

  const url = new URL(request.url);
  const viewer = await getOptionalUser(request);

  const headers = mergeHeaders(
    getDefaultRequestHeaders(request),
    await getUserOrServiceAccountHeaders(request),
  );
  const {
    payload: { schemas },
  } = await dataFnMiddleware(
    request,
    client.v2.listDatabaseSchemas({
      headers,
      params,
      searchParams: new URLSearchParams({ include: "columns" }),
    }),
  ).then(extractMessageOrThrow("list_database_schemas"));

  const tables =
    schemas.find((s) => s.name === params.schema_name)?.tables ?? [];
  const columns =
    tables.find((t) => t.name === params.table_name)?.columns ?? [];

  const submission = parseWithZod(url.searchParams, {
    schema: buildRunQueryIntentSchema({
      intent: {
        columns: z
          .array(z.string())
          .min(1)
          .default(columns.map((column) => column.name).slice(0, 25)),
        filters: z.array(getFilterColumnDef(columns)).default([]),
        schema: z.string().default(""),
        table: z.string().default(""),
      },
    }),
  });

  const query =
    submission.status === "success"
      ? submission.value.query
      : ({
          type: "intent",
          description: null,
          intent: {
            columns: columns.map((column) => column.name).slice(0, 25),
            filters: [],
            schema: params.schema_name,
            table: params.table_name,
            combinator: "AND",
            dml: "SELECT",
            limit: 40,
            orders: [],
          },
        } satisfies z.output<
          ReturnType<typeof buildRunQueryIntentSchema>
        >["query"]);

  const resultResponse = await dataFnMiddleware(
    request,
    client.v2.runQuery({
      body: {
        database_slug: params.database_slug,
        query,
      },
      headers,
      params,
    }),
  );

  const resultMessage = await resultResponse.json();

  if (resultMessage.type !== "run_query") {
    throw redirect(
      `/orgs/${params.org_slug}/databases/${params.database_slug}/explorer`,
      {
        headers: await setFlashHeaders({
          type: "error",
          message:
            resultMessage.type === "error"
              ? resultMessage.payload.error.message
              : resultMessage.type === "validation_error"
                ? resultMessage.payload.validation_error.message
                : "An error occurred.",
        }),
      },
    );
  }

  const [
    {
      payload: { connection },
    },
  ] = await Promise.all([
    dataFnMiddleware(
      request,
      client.v2.getDatabaseConnection({
        headers,
        params,
      }),
    ).then(extractMessageOrThrow("get_database_connection")),
  ]);

  const sqlSchema: Record<string, string[]> = {};
  for (const schema of schemas) {
    if (schema.tables) {
      for (const table of schema.tables) {
        if (table.columns) {
          const columnNames = table.columns.map((c) => c.name);
          const fullTableName = `${schema.name}.${table.name}`;
          sqlSchema[fullTableName] = columnNames;
          sqlSchema[table.name] = columnNames;
        }
      }
    }
  }

  const primaryKeyColumnNames = columns
    .filter((c) => c.is_primary_key)
    .map((c) => c.name);
  const resultColumnNames = resultMessage.payload.result.columns.map(
    (c) => c.name,
  );
  const canCreateChangeRequest =
    query.type === "intent" &&
    primaryKeyColumnNames.length > 0 &&
    primaryKeyColumnNames.every(
      resultColumnNames.includes.bind(resultColumnNames),
    );

  const flags = await getFlags(request);

  const records = resultMessage.payload.result.records.map(
    recordToColumnStringArray,
  );

  const fullResultColumns = resultMessage.payload.result.columns.map(
    (col) => columns.find(getFullColumn(col)) ?? buildFullColumn(col),
  );

  return {
    canCreateChangeRequest,
    columns,
    connection,
    flags,
    fullResultColumns,
    query,
    records,
    sqlSchema,
    viewer,
  };
}

export async function action({ request, params }: ActionFunctionArgs) {
  assertResponseParams(params, [
    "org_slug",
    "database_slug",
    "schema_name",
    "table_name",
  ]);
  const headers = mergeHeaders(
    getDefaultRequestHeaders(request),
    await getUserOrServiceAccountHeaders(request),
  );
  const formData = await request.formData();
  await validateCsrf(formData, request.headers);

  const submission = parseWithZod(formData, { schema });
  if (submission.status !== "success") {
    return submission.reply();
  }

  switch (submission.value.intent) {
    case INTENTS.createQuery: {
      const response = await dataFnMiddleware(
        request,
        client.v2.createQuery({
          body: {
            database_slug: params.database_slug,
            query: submission.value.query,
          },
          headers,
          params,
        }),
      );

      const message = await response.json();

      if (message.type !== "create_query") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      throw redirect(
        `/orgs/${message.payload.query.org_slug}/databases/${message.payload.query.database_slug}/explorer/queries/${message.payload.query.id}`,
        {
          headers: await setFlashHeaders({
            type: "success",
            message: "This Query has been created successfully.",
          }),
        },
      );
    }
    case INTENTS.createChangeRequest: {
      const response = await dataFnMiddleware(
        request,
        client.v2.createChangeRequest({
          body: {
            labels: [],
            reviewers: [],
            related_issues: [],
            title: submission.value.title,
            description: submission.value.description,
            changes: submission.value.changes,
          },
          headers,
          params,
        }),
      );

      const message = await response.json();

      if (message.type !== "create_change_request") {
        const errors = errorMessageToReplyOptions(message);

        errors.fieldErrors = undefined;

        return submission.reply(errors);
      }

      throw redirect(
        `/orgs/${params.org_slug}/databases/${params.database_slug}/change-requests/${message.payload.change_request.change_request_number}/data-changes`,
        {
          headers: await setFlashHeaders({
            type: "success",
            message: "Change Request created successfully.",
          }),
        },
      );
    }
    default: {
      return submission.reply(errorMessageToReplyOptions(generalErrorMessage));
    }
  }
}

export const shouldRevalidate: ShouldRevalidateFunction = (args) => {
  if (
    args.formAction ===
    `/orgs/${args.nextParams.org_slug}/databases/${args.nextParams.database_slug}/explorer/describe`
  ) {
    return false;
  }

  return args.defaultShouldRevalidate;
};

export default function Route() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const params = useParams();

  return (
    <DataExplorerTable
      connectionId={loaderData.connection.id}
      sqlEnabled={!!loaderData.connection.readonly_connection_id}
      canCreateChangeRequest={loaderData.canCreateChangeRequest}
      canDescribeChanges={loaderData.flags.describeChanges}
      columns={loaderData.columns}
      databaseSlug={params.database_slug!}
      fullResultColumns={loaderData.fullResultColumns}
      lastResult={actionData}
      orgSlug={params.org_slug!}
      query={loaderData.query}
      records={loaderData.records}
      sqlSchema={loaderData.sqlSchema}
      viewer={loaderData.viewer}
      runQueryIntentSchema={buildRunQueryIntentSchema({
        intent: {
          columns: z
            .array(z.string())
            .min(1)
            .default(loaderData.columns.map((c) => c.name)),
          filters: z.array(getFilterColumnDef(loaderData.columns)).default([]),
          schema: z
            .string()
            .min(1)
            .default(
              loaderData.query.type === "intent"
                ? loaderData.query.intent.schema
                : params.schema_name!,
            ),
          table: z
            .string()
            .min(1)
            .default(
              loaderData.query.type === "intent"
                ? loaderData.query.intent.table
                : params.table_name!,
            ),
        },
      })}
    />
  );
}
