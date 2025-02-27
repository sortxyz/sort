import type { TypedRequestInit, TypedResponse } from "./types/index.js";
import type * as V2 from "./types/v2/index.js";

function isNonNullable<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined;
}

function isNonNullableObject<T>(value: T): value is NonNullable<T> & object {
  return typeof value === "object" && isNonNullable(value);
}

function typedRequestInitToRequestInit<T>(
  init: TypedRequestInit<T>,
): RequestInit {
  return {
    ...init,
    body: JSON.stringify(init.body),
  };
}

const DEFAULT_HEADERS = {
  Accept: "application/json",
};

const DEFAULT_HEADERS_WITH_BODY = {
  ...DEFAULT_HEADERS,
  "Content-Type": "application/json",
};

function combineUrlAndSearchParams(
  url: URL,
  ...urlSearchParams: (URLSearchParams | undefined)[]
): URL {
  const searchParams = mergeUrlSearchParams(
    url.searchParams,
    ...urlSearchParams,
  );
  if (searchParams.size) {
    url.search = searchParams.toString();
  }

  return url;
}

function mergeUrlSearchParams(
  ...urlSearchParams: (URLSearchParams | undefined)[]
) {
  const mergedUrlSearchParams = new URLSearchParams();

  for (const searchParams of urlSearchParams) {
    if (searchParams instanceof URLSearchParams) {
      searchParams.forEach((value, name) => {
        mergedUrlSearchParams.append(name, value);
      });
    }
  }

  return mergedUrlSearchParams;
}

export function mergeHeaders(
  ...headerInits: (HeadersInit | undefined)[]
): Headers {
  const mergedHeaders = new Headers();
  for (const headerInit of headerInits) {
    if (headerInit instanceof Headers || Array.isArray(headerInit)) {
      for (const [name, value] of headerInit) {
        mergedHeaders.append(name, value);
      }
    } else if (isNonNullableObject(headerInit)) {
      for (const [name, value] of Object.entries(headerInit)) {
        mergedHeaders.append(name, value);
      }
    }
  }

  return mergedHeaders;
}

export function mergeRequestInits(
  ...requestInits: (RequestInit | undefined)[]
) {
  const mergedRequestInit: RequestInit = {};

  mergedRequestInit.headers = mergeHeaders(
    ...requestInits.map((init) => init?.headers),
  );

  for (const requestInit of requestInits) {
    if (!requestInit) {
      continue;
    }
    for (const [key, value] of Object.entries(requestInit)) {
      if (key === "headers") {
        continue;
      }
      if (mergedRequestInit[key as keyof RequestInit] !== undefined) {
        console.warn("Duplicate key in request init:", key);
      }
      // @ts-expect-error key is dynamic
      mergedRequestInit[key as keyof RequestInit] =
        value as RequestInit[keyof RequestInit];
    }
  }

  return mergedRequestInit;
}

export class APIClient {
  private base: URL | string;
  constructor({ base }: { base: string | URL }) {
    this.base = base;
  }

  v2 = {
    listTableColumns: ({
      params,
      ...init
    }: RequestInit & {
      params: Record<
        "org_slug" | "database_slug" | "schema_name" | "table_name",
        string
      >;
    }): Promise<
      TypedResponse<
        | V2.Message<"list_table_columns", { columns: V2.Column[] }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/databases/${params.database_slug}/schemas/${params.schema_name}/tables/${params.table_name}/columns`,
          this.base,
        ),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "GET",
        }),
      );
    },

    getQuery: ({
      params,
      ...init
    }: RequestInit & {
      params: Record<"org_slug" | "query_id", string>;
    }): Promise<
      TypedResponse<
        | V2.Message<"get_query", { query: V2.Query }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/queries/${params.query_id}`,
          this.base,
        ),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "GET",
        }),
      );
    },

    listMyOrganizations: (
      init?: RequestInit,
    ): Promise<
      TypedResponse<
        | V2.Message<
            "list_my_organizations",
            { organizations: V2.Organization[] }
          >
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL("/v2/my/orgs", this.base),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "GET",
        }),
      );
    },

    getMyProfile: (
      init?: RequestInit,
    ): Promise<
      TypedResponse<
        | V2.Message<"get_my_profile", { profile: V2.Profile }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL("/v2/my/profile", this.base),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "GET",
        }),
      );
    },

    updateMyProfile: (
      init: TypedRequestInit<
        Partial<
          Pick<V2.Profile, "name" | "username" | "email"> & {
            picture: string | null;
          }
        >
      >,
    ): Promise<
      TypedResponse<
        | V2.Message<"update_my_profile", { profile: V2.Profile }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL("/v2/my/profile", this.base),
        mergeRequestInits(typedRequestInitToRequestInit(init), {
          headers: DEFAULT_HEADERS_WITH_BODY,
          method: "PATCH",
        }),
      );
    },

    listApiKeys: (
      init?: RequestInit,
    ): Promise<
      TypedResponse<
        | V2.Message<"list_api_keys", { api_keys: V2.APIKey[] }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL("/v2/my/api-keys", this.base),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "GET",
        }),
      );
    },

    createAPIKey: (
      init: TypedRequestInit<Pick<V2.APIKey, "summary">>,
    ): Promise<
      TypedResponse<
        | V2.Message<
            "create_api_key",
            { api_key: V2.APIKey & { api_key: string } }
          >
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL("/v2/my/api-keys", this.base),
        mergeRequestInits(typedRequestInitToRequestInit(init), {
          headers: DEFAULT_HEADERS_WITH_BODY,
          method: "POST",
        }),
      );
    },

    updateAPIKey: ({
      params,
      ...init
    }: TypedRequestInit<Pick<V2.APIKey, "summary">> & {
      params: Record<"id", string>;
    }): Promise<
      TypedResponse<
        | V2.Message<"update_api_key", { api_key: V2.APIKey }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(`/v2/my/api-keys/${params.id}`, this.base),
        mergeRequestInits(typedRequestInitToRequestInit(init), {
          headers: DEFAULT_HEADERS_WITH_BODY,
          method: "PATCH",
        }),
      );
    },

    deleteAPIKey: ({
      params,
      ...init
    }: RequestInit & {
      params: Record<"id", string>;
    }): Promise<
      TypedResponse<
        V2.SuccessMessage | V2.ValidationErrorMessage | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(`/v2/my/api-keys/${params.id}`, this.base),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "DELETE",
        }),
      );
    },

    listEmailSubscriptions: (
      init?: RequestInit,
    ): Promise<
      TypedResponse<
        | V2.Message<
            "list_email_subscriptions",
            { subscriptions: V2.EmailSubscription[] }
          >
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL("/v2/my/email/subscriptions", this.base),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "GET",
        }),
      );
    },

    updateEmailSubscriptions: ({
      ...init
    }: TypedRequestInit<{
      subscriptions: V2.EmailSubscription[];
    }>): Promise<
      TypedResponse<
        | V2.Message<
            "update_email_subscriptions",
            {
              subscriptions: V2.EmailSubscription[];
            }
          >
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL("/v2/my/email/subscriptions", this.base),
        mergeRequestInits(typedRequestInitToRequestInit(init), {
          headers: DEFAULT_HEADERS_WITH_BODY,
          method: "PATCH",
        }),
      );
    },

    search: ({
      searchParams,
      ...init
    }: RequestInit & {
      /**
       * should use `q` for query
       *
       * should use `limit` to limit the number of results
       */
      searchParams?: URLSearchParams;
    }): Promise<
      TypedResponse<
        | V2.Message<"search", { results: V2.SearchResults }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        combineUrlAndSearchParams(
          new URL("/v2/search", this.base),
          searchParams,
        ),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "GET",
        }),
      );
    },

    getOrganizationInvite: ({
      params,
      searchParams,
      ...init
    }: RequestInit & {
      params: Record<"org_slug" | "invite_id", string>;
      /**
       * should use `email` for current user's email
       */
      searchParams?: URLSearchParams;
    }): Promise<
      TypedResponse<
        | V2.Message<
            "get_organization_invite",
            {
              organization: V2.Organization;
              organization_invite: V2.OrganizationInvite;
            }
          >
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        combineUrlAndSearchParams(
          new URL(
            `/v2/orgs/${params.org_slug}/invites/${params.invite_id}`,
            this.base,
          ),
          searchParams,
        ),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "GET",
        }),
      );
    },

    removeMyProfile: (
      init?: RequestInit,
    ): Promise<
      TypedResponse<
        V2.SuccessMessage | V2.ValidationErrorMessage | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL("/v2/my/profile", this.base),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "DELETE",
        }),
      );
    },

    updateOrganizationInvite: ({
      params,
      ...init
    }: TypedRequestInit<{
      status: Exclude<V2.OrganizationInvite["status"], "pending">;
      email: string;
    }> & {
      params: Record<"org_slug" | "invite_id", string>;
    }): Promise<
      TypedResponse<
        V2.SuccessMessage | V2.ValidationErrorMessage | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/invites/${params.invite_id}`,
          this.base,
        ),
        mergeRequestInits(typedRequestInitToRequestInit(init), {
          headers: DEFAULT_HEADERS_WITH_BODY,
          method: "PATCH",
        }),
      );
    },

    getOrganization: ({
      params,
      ...init
    }: RequestInit & {
      params: Record<"org_slug", string>;
    }): Promise<
      TypedResponse<
        | V2.Message<"get_organization", { organization: V2.Organization }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(`/v2/orgs/${params.org_slug}`, this.base),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "GET",
        }),
      );
    },

    createOrganization: (
      init: TypedRequestInit<
        Pick<V2.Organization, "name" | "slug" | "description" | "link">
      >,
    ): Promise<
      TypedResponse<
        | V2.Message<"create_organization", { organization: V2.Organization }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL("/v2/orgs", this.base),
        mergeRequestInits(typedRequestInitToRequestInit(init), {
          headers: DEFAULT_HEADERS_WITH_BODY,
          method: "POST",
        }),
      );
    },

    runQuery: ({
      params,
      ...init
    }: TypedRequestInit<{
      database_slug: string;
      query:
        | Pick<Extract<V2.Query, { type: "intent" }>, "type" | "intent">
        | Pick<Extract<V2.Query, { type: "sql" }>, "type" | "sql">;
    }> & {
      params: Record<"org_slug", string>;
    }): Promise<
      TypedResponse<
        | V2.Message<
            "run_query",
            {
              result: V2.QueryResult;
            }
          >
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(`/v2/orgs/${params.org_slug}/query`, this.base),
        mergeRequestInits(typedRequestInitToRequestInit(init), {
          headers: DEFAULT_HEADERS_WITH_BODY,
          method: "POST",
        }),
      );
    },

    createQuery: ({
      params,
      ...init
    }: TypedRequestInit<
      Pick<V2.Query, "database_slug"> & {
        query: V2.CreateQuery;
      }
    > & {
      params: Record<"org_slug", string>;
    }): Promise<
      TypedResponse<
        | V2.Message<"create_query", { query: V2.Query }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(`/v2/orgs/${params.org_slug}/queries`, this.base),
        mergeRequestInits(typedRequestInitToRequestInit(init), {
          headers: DEFAULT_HEADERS_WITH_BODY,
          method: "POST",
        }),
      );
    },

    updateQuery: ({
      params,
      ...init
    }: TypedRequestInit<{
      query: V2.UpdateQuery;
    }> & {
      params: Record<"org_slug" | "query_id", string>;
    }): Promise<
      TypedResponse<
        | V2.Message<"update_query", { query: V2.Query }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/queries/${params.query_id}`,
          this.base,
        ),
        mergeRequestInits(typedRequestInitToRequestInit(init), {
          headers: DEFAULT_HEADERS_WITH_BODY,
          method: "PATCH",
        }),
      );
    },

    listQueries: ({
      params,
      searchParams,
      ...init
    }: RequestInit & {
      params: Record<"org_slug", string>;
      /**
       * should use `database_slug` for database slug
       */
      searchParams?: URLSearchParams;
    }): Promise<
      TypedResponse<
        | V2.Message<"list_queries", { queries: V2.Query[] }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        combineUrlAndSearchParams(
          new URL(`/v2/orgs/${params.org_slug}/queries`, this.base),
          searchParams,
        ),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "GET",
        }),
      );
    },

    listSchemaTables: ({
      params,
      ...init
    }: RequestInit & {
      params: Record<"org_slug" | "database_slug" | "schema_name", string>;
    }): Promise<
      TypedResponse<
        | V2.Message<"list_schema_tables", { tables: V2.Table[] }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/databases/${params.database_slug}/schemas/${params.schema_name}/tables`,
          this.base,
        ),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "GET",
        }),
      );
    },

    updateDatabase: ({
      params,
      ...init
    }: TypedRequestInit<
      Partial<
        Pick<
          V2.MetadataDatabase,
          "slug" | "display_name" | "summary" | "description"
        >
      >
    > & {
      params: Record<"org_slug" | "database_slug", string>;
    }): Promise<
      TypedResponse<
        | V2.Message<"update_database", { database: V2.MetadataDatabase }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/databases/${params.database_slug}`,
          this.base,
        ),
        mergeRequestInits(typedRequestInitToRequestInit(init), {
          headers: DEFAULT_HEADERS_WITH_BODY,
          method: "PATCH",
        }),
      );
    },

    getDatabase: ({
      params,
      ...init
    }: RequestInit & {
      params: Record<"org_slug" | "database_slug", string>;
    }): Promise<
      TypedResponse<
        | V2.Message<"get_database", { database: V2.MetadataDatabase }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/databases/${params.database_slug}`,
          this.base,
        ),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "GET",
        }),
      );
    },

    listDatabaseSchemas: ({
      params,
      searchParams,
      ...init
    }: RequestInit & {
      params: Record<"org_slug" | "database_slug", string>;
    } & {
      // use include=tables or include=columns
      searchParams?: URLSearchParams;
    }): Promise<
      TypedResponse<
        | V2.Message<"list_database_schemas", { schemas: V2.Schema[] }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        combineUrlAndSearchParams(
          new URL(
            `/v2/orgs/${params.org_slug}/databases/${params.database_slug}/schemas`,
            this.base,
          ),
          searchParams,
        ),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "GET",
        }),
      );
    },

    getDatabaseConnection: ({
      params,
      ...init
    }: RequestInit & {
      params: Record<"org_slug" | "database_slug", string>;
    }): Promise<
      TypedResponse<
        | V2.Message<"get_database_connection", { connection: V2.Connection }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/databases/${params.database_slug}/connection`,
          this.base,
        ),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "GET",
        }),
      );
    },

    listDatabases: ({
      params,
      ...init
    }: RequestInit & {
      params: Record<"org_slug", string>;
    }): Promise<
      TypedResponse<
        | V2.Message<"list_databases", { databases: V2.Database[] }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(`/v2/orgs/${params.org_slug}/databases`, this.base),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "GET",
        }),
      );
    },

    listOrganizationMembers: ({
      params,
      ...init
    }: RequestInit & {
      params: Record<"org_slug", string>;
    }): Promise<
      TypedResponse<
        | V2.Message<"list_organization_members", { members: V2.Member[] }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(`/v2/orgs/${params.org_slug}/members`, this.base),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "GET",
        }),
      );
    },

    updateOrganizationMember: ({
      params,
      ...init
    }: TypedRequestInit<{
      role_id: V2.Member["role"]["id"];
    }> & {
      params: Record<"org_slug" | "member_username", string>;
    }): Promise<
      TypedResponse<
        | V2.Message<"update_organization_member", { member: V2.Member }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/members/${params.member_username}`,
          this.base,
        ),
        mergeRequestInits(typedRequestInitToRequestInit(init), {
          headers: DEFAULT_HEADERS_WITH_BODY,
          method: "PATCH",
        }),
      );
    },

    removeOrganizationMember: ({
      params,
      ...init
    }: RequestInit & {
      params: Record<"org_slug" | "member_username", string>;
    }): Promise<
      TypedResponse<
        V2.SuccessMessage | V2.ValidationErrorMessage | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/members/${params.member_username}`,
          this.base,
        ),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "DELETE",
        }),
      );
    },

    listOrganizationInvites: ({
      params,
      ...init
    }: RequestInit & {
      params: Record<"org_slug", string>;
    }): Promise<
      TypedResponse<
        | V2.Message<
            "list_organization_invites",
            { organization_invites: V2.OrganizationInvite[] }
          >
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(`/v2/orgs/${params.org_slug}/invites`, this.base),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "GET",
        }),
      );
    },

    createOrganizationInvite: ({
      params,
      ...init
    }: TypedRequestInit<{
      email: string;
      role_id: V2.Member["role"]["id"];
      name: string;
    }> & {
      params: Record<"org_slug", string>;
    }): Promise<
      TypedResponse<
        | V2.Message<
            "create_organization_invite",
            { organization_invite: V2.OrganizationInvite }
          >
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(`/v2/orgs/${params.org_slug}/invites`, this.base),
        mergeRequestInits(typedRequestInitToRequestInit(init), {
          headers: DEFAULT_HEADERS_WITH_BODY,
          method: "POST",
        }),
      );
    },

    removeOrganization: ({
      params,
      ...init
    }: RequestInit & {
      params: Record<"org_slug", string>;
    }): Promise<
      TypedResponse<
        V2.SuccessMessage | V2.ValidationErrorMessage | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(`/v2/orgs/${params.org_slug}`, this.base),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "DELETE",
        }),
      );
    },

    updateOrganization: ({
      params,
      ...init
    }: TypedRequestInit<
      Partial<Pick<V2.Organization, "name" | "slug" | "description" | "link">>
    > & {
      params: Record<"org_slug", string>;
    }): Promise<
      TypedResponse<
        | V2.Message<"update_organization", { organization: V2.Organization }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(`/v2/orgs/${params.org_slug}`, this.base),
        mergeRequestInits(typedRequestInitToRequestInit(init), {
          headers: DEFAULT_HEADERS_WITH_BODY,
          method: "PATCH",
        }),
      );
    },

    listConnections: ({
      params,
      ...init
    }: RequestInit & {
      params: Record<"org_slug", string>;
    }): Promise<
      TypedResponse<
        | V2.Message<"list_connections", { connections: V2.Connection[] }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(`/v2/orgs/${params.org_slug}/connections`, this.base),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "GET",
        }),
      );
    },

    deleteOrganizationConnection: ({
      params,
      ...init
    }: RequestInit & {
      params: Record<"org_slug" | "connection_id", string>;
    }): Promise<
      TypedResponse<
        V2.SuccessMessage | V2.ValidationErrorMessage | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/connections/${params.connection_id}`,
          this.base,
        ),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "DELETE",
        }),
      );
    },

    getConnection: ({
      params,
      ...init
    }: RequestInit & {
      params: Record<"org_slug" | "connection_id", string>;
    }): Promise<
      TypedResponse<
        | V2.Message<"get_connection", { connection: V2.Connection }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/connections/${params.connection_id}`,
          this.base,
        ),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "GET",
        }),
      );
    },

    createConnection: ({
      params,
      ...init
    }: TypedRequestInit<
      Pick<V2.Connection, "name" | "data_provider" | "visibility"> &
        (
          | {
              type: "connection_string";
              connection_string: string;
            }
          | {
              type: "parameters";
              parameters: {
                database: string;
                host: string;
                password: string;
                port: number;
                user: string;
              };
            }
        ) & {
          read_only?: boolean;
          parent_connection_id?: string;
        }
    > & {
      params: Record<"org_slug", string>;
    }): Promise<
      TypedResponse<
        | V2.Message<"create_connection", { connection: V2.Connection }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(`/v2/orgs/${params.org_slug}/connections`, this.base),
        mergeRequestInits(typedRequestInitToRequestInit(init), {
          headers: DEFAULT_HEADERS_WITH_BODY,
          method: "POST",
        }),
      );
    },

    testOrganizationConnection: ({
      params,
      ...init
    }: TypedRequestInit<
      | (Pick<V2.Connection, "data_provider"> & {
          type: "connection_string";
          connection_string: string;
        })
      | (Pick<V2.Connection, "data_provider"> & {
          type: "parameters";
          parameters: {
            database: string;
            host: string;
            password: string;
            port: number;
            user: string;
          };
        })
      | {
          type: "persisted";
          id: string;
        }
    > & {
      params: Record<"org_slug", string>;
    }): Promise<
      TypedResponse<
        | V2.Message<"test_connection", { connection_test: V2.ConnectionTest }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(`/v2/orgs/${params.org_slug}/connections/test`, this.base),
        mergeRequestInits(typedRequestInitToRequestInit(init), {
          headers: DEFAULT_HEADERS_WITH_BODY,
          method: "POST",
        }),
      );
    },

    createSchemaSnapshot: ({
      params,
      ...init
    }: RequestInit & {
      params: Record<"org_slug" | "connection_id", string>;
    }): Promise<
      TypedResponse<
        | V2.Message<"create_schema_snapshot", { schema_snapshot_id: string }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/connections/${params.connection_id}/schema`,
          this.base,
        ),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "POST",
        }),
      );
    },

    updateOrganizationConnection: ({
      params,
      ...init
    }: TypedRequestInit<
      | ({ type: "connection_string" } & Partial<
          Pick<V2.Connection, "name" | "data_provider" | "visibility"> & {
            connection_string?: string;
          }
        >)
      | ({
          type: "parameters";
        } & Partial<
          Pick<V2.Connection, "name" | "data_provider" | "visibility"> & {
            parameters?: {
              database?: string;
              host?: string;
              password?: string;
              port?: number;
              user?: string;
            };
          }
        >)
    > & {
      params: Record<"org_slug" | "connection_id", string>;
    }): Promise<
      TypedResponse<
        | V2.Message<"update_connection", { connection: V2.Connection }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/connections/${params.connection_id}`,
          this.base,
        ),
        mergeRequestInits(typedRequestInitToRequestInit(init), {
          headers: DEFAULT_HEADERS_WITH_BODY,
          method: "PATCH",
        }),
      );
    },

    initializeUser: (
      init?: RequestInit,
    ): Promise<
      TypedResponse<
        V2.Message<"initialize_user", { jwt: string; profile: V2.Profile }>
      >
    > => {
      return fetch(new URL("/v2/special/users", this.base), {
        ...mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "PUT",
        }),
      });
    },

    initializeOnPremUser: (
      init?: RequestInit,
    ): Promise<
      TypedResponse<
        V2.Message<
          "initialize_onprem_user",
          { jwt: string; profile: V2.Profile }
        >
      >
    > => {
      return fetch(new URL("/v2/special/onprem/users", this.base), {
        ...mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "PUT",
        }),
      });
    },

    sendVerificationEmail: ({
      ...init
    }: TypedRequestInit<{
      email?: string;
    }>): Promise<
      TypedResponse<
        V2.SuccessMessage | V2.ValidationErrorMessage | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL("/v2/my/profile/verify-email", this.base),
        mergeRequestInits(typedRequestInitToRequestInit(init), {
          headers: DEFAULT_HEADERS_WITH_BODY,
          method: "POST",
        }),
      );
    },

    verifyEmail: ({
      ...init
    }: TypedRequestInit<{
      subscribe: boolean;
      key: string;
    }>): Promise<
      TypedResponse<
        V2.SuccessMessage | V2.ValidationErrorMessage | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL("/v2/special/users/verify-email", this.base),
        mergeRequestInits(typedRequestInitToRequestInit(init), {
          headers: DEFAULT_HEADERS_WITH_BODY,
          method: "PATCH",
        }),
      );
    },

    getHomePageData: ({
      ...init
    }: RequestInit): Promise<
      TypedResponse<
        | V2.Message<
            "get_home_page_data",
            {
              databases: V2.HomePageDatabase[];
              queries: V2.HomePageQuery[];
            }
          >
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(new URL("/v2/special/home", this.base), {
        ...mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "GET",
        }),
      });
    },

    listIssues: ({
      params,
      ...init
    }: RequestInit & {
      params: Record<"org_slug" | "database_slug", string>;
    }): Promise<
      TypedResponse<
        | V2.Message<"list_issues", { issues: V2.Issue[] }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/databases/${params.database_slug}/issues`,
          this.base,
        ),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "GET",
        }),
      );
    },

    searchIssues: ({
      params,
      searchParams,
      ...init
    }: RequestInit & {
      params: Record<"org_slug" | "database_slug", string>;
      /**
       * use `q` for the query text
       * use `limit` for the max number of results
       */
      searchParams?: URLSearchParams;
    }): Promise<
      TypedResponse<
        | V2.Message<"search_issues", { issues: V2.Issue[] }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        combineUrlAndSearchParams(
          new URL(
            `/v2/orgs/${params.org_slug}/databases/${params.database_slug}/search/issues`,
            this.base,
          ),
          searchParams,
        ),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "GET",
        }),
      );
    },

    getIssue: ({
      params,
      ...init
    }: RequestInit & {
      params: Record<"org_slug" | "database_slug" | "issue_number", string>;
    }): Promise<
      TypedResponse<
        | V2.Message<"get_issue", { issue: V2.Issue }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/databases/${params.database_slug}/issues/${params.issue_number}`,
          this.base,
        ),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "GET",
        }),
      );
    },

    createIssue: ({
      params,
      ...init
    }: TypedRequestInit<{
      title: string;
      description: string | null;
      labels: string[];
      assignees: string[];
    }> & {
      params: Record<"org_slug" | "database_slug", string>;
    }): Promise<
      TypedResponse<
        | V2.Message<"create_issue", { issue: V2.Issue }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/databases/${params.database_slug}/issues`,
          this.base,
        ),
        mergeRequestInits(typedRequestInitToRequestInit(init), {
          headers: DEFAULT_HEADERS_WITH_BODY,
          method: "POST",
        }),
      );
    },

    updateIssue: ({
      params,
      ...init
    }: TypedRequestInit<
      Partial<
        Pick<V2.Issue, "title" | "description" | "status"> & {
          labels: string[];
          assignees: string[];
          related_change_requests: number[];
        }
      >
    > & {
      params: Record<"org_slug" | "database_slug" | "issue_number", string>;
    }): Promise<
      TypedResponse<
        | V2.Message<"update_issue", { issue: V2.Issue }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/databases/${params.database_slug}/issues/${params.issue_number}`,
          this.base,
        ),
        mergeRequestInits(typedRequestInitToRequestInit(init), {
          headers: DEFAULT_HEADERS_WITH_BODY,
          method: "PATCH",
        }),
      );
    },

    listDatabaseLabels: ({
      params,
      ...init
    }: RequestInit & {
      params: Record<"org_slug" | "database_slug", string>;
    }): Promise<
      TypedResponse<
        | V2.Message<"list_database_labels", { labels: V2.Label[] }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/databases/${params.database_slug}/labels`,
          this.base,
        ),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "GET",
        }),
      );
    },

    createLabel: ({
      params,
      ...init
    }: TypedRequestInit<{
      name: string;
      description: string | null;
      color: string;
    }> & {
      params: Record<"org_slug" | "database_slug", string>;
    }): Promise<
      TypedResponse<
        | V2.Message<"create_database_label", { label: V2.Label }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/databases/${params.database_slug}/labels`,
          this.base,
        ),
        mergeRequestInits(typedRequestInitToRequestInit(init), {
          headers: DEFAULT_HEADERS_WITH_BODY,
          method: "POST",
        }),
      );
    },

    updateLabel: ({
      params,
      ...init
    }: TypedRequestInit<{
      name: string;
      description: string | null;
      color: string;
    }> & {
      params: Record<"org_slug" | "database_slug" | "label_id", string>;
    }): Promise<
      TypedResponse<
        | V2.Message<"update_database_label", { label: V2.Label }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/databases/${params.database_slug}/labels/${params.label_id}`,
          this.base,
        ),
        mergeRequestInits(typedRequestInitToRequestInit(init), {
          headers: DEFAULT_HEADERS_WITH_BODY,
          method: "PATCH",
        }),
      );
    },

    getDatabaseLabel: ({
      params,
      ...init
    }: RequestInit & {
      params: Record<"org_slug" | "database_slug" | "label_id", string>;
    }): Promise<
      TypedResponse<
        | V2.Message<"get_database_label", { label: V2.Label }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/databases/${params.database_slug}/labels/${params.label_id}`,
          this.base,
        ),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "GET",
        }),
      );
    },

    deleteLabel: ({
      params,
      ...init
    }: RequestInit & {
      params: Record<"org_slug" | "database_slug" | "label_id", string>;
    }): Promise<
      TypedResponse<
        V2.SuccessMessage | V2.ValidationErrorMessage | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/databases/${params.database_slug}/labels/${params.label_id}`,
          this.base,
        ),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "DELETE",
        }),
      );
    },

    listIssueTimeline: ({
      params,
      ...init
    }: RequestInit & {
      params: Record<"org_slug" | "database_slug" | "issue_number", string>;
    }): Promise<
      TypedResponse<
        | V2.Message<
            "list_issue_timeline",
            { issue_timeline: V2.IssueTimelineItem[] }
          >
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/databases/${params.database_slug}/issues/${params.issue_number}/timeline`,
          this.base,
        ),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "GET",
        }),
      );
    },

    createIssueComment: ({
      params,
      ...init
    }: TypedRequestInit<{
      content: V2.IssueComment["content"];
      id?: V2.IssueComment["id"];
    }> & {
      params: Record<"org_slug" | "database_slug" | "issue_number", string>;
    }): Promise<
      TypedResponse<
        | V2.Message<"create_issue_comment", { issue_comment: V2.IssueComment }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/databases/${params.database_slug}/issues/${params.issue_number}/comments`,
          this.base,
        ),
        mergeRequestInits(typedRequestInitToRequestInit(init), {
          headers: DEFAULT_HEADERS_WITH_BODY,
          method: "POST",
        }),
      );
    },

    updateIssueComment: ({
      params,
      ...init
    }: TypedRequestInit<{
      content: V2.IssueComment["content"];
    }> & {
      params: Record<
        "org_slug" | "database_slug" | "issue_number" | "comment_id",
        string
      >;
    }): Promise<
      TypedResponse<
        | V2.Message<"update_issue_comment", { issue_comment: V2.IssueComment }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/databases/${params.database_slug}/issues/${params.issue_number}/comments/${params.comment_id}`,
          this.base,
        ),
        mergeRequestInits(typedRequestInitToRequestInit(init), {
          headers: DEFAULT_HEADERS_WITH_BODY,
          method: "PATCH",
        }),
      );
    },

    deleteIssueComment: ({
      params,
      ...init
    }: RequestInit & {
      params: Record<
        "org_slug" | "database_slug" | "issue_number" | "comment_id",
        string
      >;
    }): Promise<
      TypedResponse<
        V2.SuccessMessage | V2.ValidationErrorMessage | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/databases/${params.database_slug}/issues/${params.issue_number}/comments/${params.comment_id}`,
          this.base,
        ),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS_WITH_BODY,
          method: "DELETE",
        }),
      );
    },

    listChangeRequests: ({
      params,
      ...init
    }: RequestInit & {
      params: Record<"org_slug" | "database_slug", string>;
    }): Promise<
      TypedResponse<
        | V2.Message<
            "list_change_requests",
            { change_requests: V2.ChangeRequest[] }
          >
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/databases/${params.database_slug}/change-requests`,
          this.base,
        ),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "GET",
        }),
      );
    },

    getChangeRequest: ({
      params,
      ...init
    }: RequestInit & {
      params: Record<
        "org_slug" | "database_slug" | "change_request_number",
        string
      >;
    }): Promise<
      TypedResponse<
        | V2.Message<"get_change_request", { change_request: V2.ChangeRequest }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/databases/${params.database_slug}/change-requests/${params.change_request_number}`,
          this.base,
        ),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "GET",
        }),
      );
    },

    listChangeRequestHistory: ({
      params,
      ...init
    }: RequestInit & {
      params: Record<
        "org_slug" | "database_slug" | "change_request_number",
        string
      >;
    }): Promise<
      TypedResponse<
        | V2.Message<
            "list_change_request_history",
            { change_request_history: V2.ChangeRequestTimelineItem[] }
          >
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/databases/${params.database_slug}/change-requests/${params.change_request_number}/history`,
          this.base,
        ),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "GET",
        }),
      );
    },

    listChangeRequestTimeline: ({
      params,
      ...init
    }: RequestInit & {
      params: Record<
        "org_slug" | "database_slug" | "change_request_number",
        string
      >;
    }): Promise<
      TypedResponse<
        | V2.Message<
            "list_change_request_timeline",
            { change_request_timeline: V2.ChangeRequestTimelineItem[] }
          >
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/databases/${params.database_slug}/change-requests/${params.change_request_number}/timeline`,
          this.base,
        ),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "GET",
        }),
      );
    },

    createChangeRequest: ({
      params,
      ...init
    }: TypedRequestInit<{
      description: string | null;
      labels: string[];
      reviewers: string[];
      title: string;
      changes?: V2.CreateChange[];
      related_issues?: number[];
    }> & {
      params: Record<"org_slug" | "database_slug", string>;
    }): Promise<
      TypedResponse<
        | V2.Message<
            "create_change_request",
            { change_request: V2.ChangeRequest }
          >
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/databases/${params.database_slug}/change-requests`,
          this.base,
        ),
        mergeRequestInits(typedRequestInitToRequestInit(init), {
          headers: DEFAULT_HEADERS_WITH_BODY,
          method: "POST",
        }),
      );
    },

    updateChangeRequest: ({
      params,
      ...init
    }: TypedRequestInit<
      Partial<
        Pick<V2.ChangeRequest, "title" | "description" | "status"> & {
          labels: string[];
          reviewers: string[];
          related_issues: number[];
        }
      >
    > & {
      params: Record<
        "org_slug" | "database_slug" | "change_request_number",
        string
      >;
    }): Promise<
      TypedResponse<
        | V2.Message<
            "update_change_request",
            { change_request: V2.ChangeRequest }
          >
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/databases/${params.database_slug}/change-requests/${params.change_request_number}`,
          this.base,
        ),
        mergeRequestInits(typedRequestInitToRequestInit(init), {
          headers: DEFAULT_HEADERS_WITH_BODY,
          method: "PATCH",
        }),
      );
    },

    searchChangeRequests: ({
      params,
      searchParams,
      ...init
    }: RequestInit & {
      params: Record<"org_slug" | "database_slug", string>;
      /**
       * use `q` for the query text
       * use `limit` for the max number of results
       */
      searchParams: URLSearchParams;
    }): Promise<
      TypedResponse<
        | V2.Message<
            "search_change_requests",
            { change_requests: V2.ChangeRequest[] }
          >
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        combineUrlAndSearchParams(
          new URL(
            `/v2/orgs/${params.org_slug}/databases/${params.database_slug}/search/change-requests`,
            this.base,
          ),
          searchParams,
        ),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "GET",
        }),
      );
    },

    getOrganizationDashboard: ({
      params,
      searchParams,
      ...init
    }: RequestInit & {
      params: Record<"org_slug", string>;
      /**
       * use `item_type` for the item type, eg. "issues" or "change_requests"
       * use `status` for the status of the items, eg. "open" or "closed"
       */
      searchParams: URLSearchParams;
    }): Promise<
      TypedResponse<
        | V2.Message<
            "get_organization_dashboard",
            { dashboard: V2.DashboardItem[] }
          >
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        combineUrlAndSearchParams(
          new URL(`/v2/orgs/${params.org_slug}/dashboard`, this.base),
          searchParams,
        ),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "GET",
        }),
      );
    },

    createChangeRequestComment: ({
      params,
      ...init
    }: TypedRequestInit<{
      content: V2.ChangeRequestComment["content"];
      change_id?: V2.ChangeRequestComment["change_id"];
    }> & {
      params: Record<
        "org_slug" | "database_slug" | "change_request_number",
        string
      >;
    }): Promise<
      TypedResponse<
        | V2.Message<
            "create_change_request_comment",
            { change_request_comment: V2.ChangeRequestComment }
          >
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/databases/${params.database_slug}/change-requests/${params.change_request_number}/comments`,
          this.base,
        ),
        mergeRequestInits(typedRequestInitToRequestInit(init), {
          headers: DEFAULT_HEADERS_WITH_BODY,
          method: "POST",
        }),
      );
    },

    updateChangeRequestComment: ({
      params,
      ...init
    }: TypedRequestInit<{
      content: V2.ChangeRequestComment["content"];
    }> & {
      params: Record<
        "org_slug" | "database_slug" | "change_request_number" | "comment_id",
        string
      >;
    }): Promise<
      TypedResponse<
        | V2.Message<
            "update_change_request_comment",
            { change_request_comment: V2.ChangeRequestComment }
          >
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/databases/${params.database_slug}/change-requests/${params.change_request_number}/comments/${params.comment_id}`,
          this.base,
        ),
        mergeRequestInits(typedRequestInitToRequestInit(init), {
          headers: DEFAULT_HEADERS_WITH_BODY,
          method: "PATCH",
        }),
      );
    },

    deleteChangeRequestComment: ({
      params,
      ...init
    }: RequestInit & {
      params: Record<
        "org_slug" | "database_slug" | "change_request_number" | "comment_id",
        string
      >;
    }): Promise<
      TypedResponse<
        V2.SuccessMessage | V2.ValidationErrorMessage | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/databases/${params.database_slug}/change-requests/${params.change_request_number}/comments/${params.comment_id}`,
          this.base,
        ),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS_WITH_BODY,
          method: "DELETE",
        }),
      );
    },

    listChanges: ({
      params,
      ...init
    }: RequestInit & {
      params: Record<
        "org_slug" | "database_slug" | "change_request_number",
        string
      >;
    }): Promise<
      TypedResponse<
        | V2.Message<"list_changes", { changes: V2.Change[] }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/databases/${params.database_slug}/change-requests/${params.change_request_number}/changes`,
          this.base,
        ),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "GET",
        }),
      );
    },

    createApproveReview: ({
      params,
      ...init
    }: TypedRequestInit<{
      event_type: V2.Review["event_type"];
      text?: V2.Review["text"];
    }> & {
      params: Record<
        "org_slug" | "database_slug" | "change_request_number",
        string
      >;
    }): Promise<
      TypedResponse<
        | V2.Message<"create_review", { review: V2.Review }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/databases/${params.database_slug}/change-requests/${params.change_request_number}/reviews`,
          this.base,
        ),
        mergeRequestInits(typedRequestInitToRequestInit(init), {
          headers: DEFAULT_HEADERS_WITH_BODY,
          method: "POST",
        }),
      );
    },

    updateReview: ({
      params,
      ...init
    }: TypedRequestInit<{
      text?: V2.Review["text"];
    }> & {
      params: Record<
        "org_slug" | "database_slug" | "change_request_number" | "review_id",
        string
      >;
    }): Promise<
      TypedResponse<
        | V2.Message<"update_review", { review: V2.Review }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/databases/${params.database_slug}/change-requests/${params.change_request_number}/reviews/${params.review_id}`,
          this.base,
        ),
        mergeRequestInits(typedRequestInitToRequestInit(init), {
          headers: DEFAULT_HEADERS_WITH_BODY,
          method: "PATCH",
        }),
      );
    },

    executeChangeRequest: ({
      params,
      ...init
    }: RequestInit & {
      params: Record<
        "org_slug" | "database_slug" | "change_request_number",
        string
      >;
    }): Promise<
      TypedResponse<
        V2.SuccessMessage | V2.ValidationErrorMessage | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/databases/${params.database_slug}/change-requests/${params.change_request_number}/execute`,
          this.base,
        ),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "PATCH",
        }),
      );
    },

    createUndoChangeRequest: ({
      params,
      ...init
    }: RequestInit & {
      params: Record<
        "org_slug" | "database_slug" | "change_request_number",
        string
      >;
    }): Promise<
      TypedResponse<
        | V2.Message<
            "create_undo_change_request",
            { change_request: V2.ChangeRequest }
          >
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/databases/${params.database_slug}/change-requests/${params.change_request_number}/undo`,
          this.base,
        ),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS,
          method: "POST",
        }),
      );
    },

    createChange: ({
      params,
      ...init
    }: TypedRequestInit<V2.CreateChange> & {
      params: Record<
        "org_slug" | "database_slug" | "change_request_number",
        string
      >;
    }): Promise<
      TypedResponse<
        | V2.Message<
            "create_change",
            {
              change: V2.Change;
            }
          >
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/databases/${params.database_slug}/change-requests/${params.change_request_number}/changes`,
          this.base,
        ),
        mergeRequestInits(typedRequestInitToRequestInit(init), {
          headers: DEFAULT_HEADERS_WITH_BODY,
          method: "POST",
        }),
      );
    },

    deleteChange: ({
      params,
      ...init
    }: RequestInit & {
      params: Record<
        "org_slug" | "database_slug" | "change_request_number" | "change_id",
        string
      >;
    }): Promise<
      TypedResponse<
        V2.SuccessMessage | V2.ErrorMessage | V2.ValidationErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/databases/${params.database_slug}/change-requests/${params.change_request_number}/changes/${params.change_id}`,
          this.base,
        ),
        mergeRequestInits(init, {
          headers: DEFAULT_HEADERS_WITH_BODY,
          method: "DELETE",
        }),
      );
    },

    revokeSessions: (
      init: TypedRequestInit<{
        user_id: string;
        secret: string;
      }>,
    ): Promise<
      TypedResponse<
        V2.SuccessMessage | V2.ValidationErrorMessage | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL("/v2/special/users/revoke-sessions", this.base),
        mergeRequestInits(typedRequestInitToRequestInit(init), {
          headers: DEFAULT_HEADERS_WITH_BODY,
          method: "POST",
        }),
      );
    },

    createChanges: ({
      params,
      ...init
    }: TypedRequestInit<V2.CreateChange[]> & {
      params: Record<
        "org_slug" | "database_slug" | "change_request_number",
        string
      >;
    }): Promise<
      TypedResponse<
        | V2.Message<"create_changes", { changes: V2.Change[] }>
        | V2.ValidationErrorMessage
        | V2.ErrorMessage
      >
    > => {
      return fetch(
        new URL(
          `/v2/orgs/${params.org_slug}/databases/${params.database_slug}/change-requests/${params.change_request_number}/changes/batch`,
          this.base,
        ),
        mergeRequestInits(typedRequestInitToRequestInit(init), {
          headers: DEFAULT_HEADERS_WITH_BODY,
          method: "POST",
        }),
      );
    },
  };
}

export type { Json, TypedResponse } from "./types/index.js";
export type * as V2 from "./types/v2/index.js";
