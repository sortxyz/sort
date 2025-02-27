import { mergeHeaders } from "@sort/sdk";
import type { LoaderFunctionArgs } from "react-router";
import { redirectDocument } from "react-router";
import { client } from "~/sdk/client.server";
import {
  getDefaultRequestHeaders,
  getUserOrServiceAccountHeaders,
} from "~/services/auth.server";
import { dataFnMiddleware } from "~/utils/request.server";
import {
  assertResponse,
  assertResponseParams,
  extractMessageOrThrow,
} from "~/utils/response";

export async function loader({ request, params }: LoaderFunctionArgs) {
  assertResponseParams(params, ["org_slug", "database_slug"]);
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
    }),
  ).then(extractMessageOrThrow("list_database_schemas"));

  const schema_name =
    schemas.find((schema) => schema.name === "public")?.name ??
    schemas[0]?.name;

  assertResponse(schema_name, "Schema not found", { status: 404 });

  throw redirectDocument(
    `/orgs/${params.org_slug}/databases/${params.database_slug}/explorer/schemas/${schema_name}/tables`,
  );
}
