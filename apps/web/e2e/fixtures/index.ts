import { faker } from "@faker-js/faker";
import type {
  PlaywrightTestArgs,
  PlaywrightTestOptions,
  TestFixture,
} from "@playwright/test";
import type { V2 } from "@sort/sdk";
import { APIClient } from "@sort/sdk";
import { extractMessageOrThrow, getUserHeaders, retryFn } from "../utils";

export const client = new APIClient({
  base: process.env.SORT_WEB_API_BASE_URL!,
});

export const createOrganizationFixture: TestFixture<
  V2.Organization,
  PlaywrightTestArgs & PlaywrightTestOptions
> = async ({ page }, use) => {
  const headers = await getUserHeaders(page);
  const organization = await retryFn(async function createOrganization() {
    const {
      payload: { organization },
    } = await client.v2
      .createOrganization({
        body: {
          description: faker.lorem.paragraph(),
          link: faker.internet.url(),
          name: faker.company.name(),
          slug: faker.lorem.slug(),
        },
        headers,
      })
      .then(extractMessageOrThrow("create_organization"));
    return organization;
  });

  await use(organization);

  await retryFn(function removeOrganization() {
    return client.v2.removeOrganization({
      headers,
      params: { org_slug: organization.slug },
    });
  });
};

export const createConnectionFixture: TestFixture<
  V2.Connection,
  PlaywrightTestArgs & PlaywrightTestOptions & { organization: V2.Organization }
> = async ({ page, organization }, use) => {
  const headers = await getUserHeaders(page);

  const connection = await retryFn(async function createConnection() {
    const {
      payload: { connection },
    } = await client.v2
      .createConnection({
        body: {
          connection_string: process.env.TEST_DATABASE_URL!,
          data_provider: "postgres",
          name: faker.airline.airport().name,
          type: "connection_string",
          visibility: "private",
        },
        params: {
          org_slug: organization.slug,
        },
        headers,
      })
      .then(extractMessageOrThrow("create_connection"));
    return connection;
  });

  await retryFn(function createReadOnlyConnection() {
    return client.v2
      .createConnection({
        body: {
          type: "connection_string",
          connection_string: process.env.TEST_DATABASE_URL!,
          data_provider: connection.data_provider,
          name: connection.name,
          parent_connection_id: connection.id,
          read_only: true,
          visibility: "private",
        },
        params: {
          org_slug: organization.slug,
        },
        headers,
      })
      .then(extractMessageOrThrow("create_connection"));
  });

  await use(connection);

  await retryFn(function deleteConnection() {
    return client.v2.deleteOrganizationConnection({
      headers,
      params: { org_slug: organization.slug, connection_id: connection.id },
    });
  });
};

export const listDatabasesFixture =
  (
    predicate?: (database: V2.Database) => boolean,
  ): TestFixture<
    V2.Database[],
    PlaywrightTestArgs &
      PlaywrightTestOptions & {
        organization: V2.Organization;
        connection: V2.Connection;
      }
  > =>
  async ({ page, organization, connection: _ }, use) => {
    const headers = await getUserHeaders(page);
    const databases = await retryFn(async function listDatabases() {
      const {
        payload: { databases },
      } = await client.v2
        .listDatabases({
          params: {
            org_slug: organization.slug,
          },
          headers,
        })
        .then(extractMessageOrThrow("list_databases"));

      if (!databases.length) {
        throw new Error("No databases found");
      }
      return databases;
    }, 10);
    await use(predicate ? databases.filter(predicate) : databases);
  };

export const databaseFixture =
  (
    predicate: (database: V2.Database) => boolean,
  ): TestFixture<
    V2.Database,
    PlaywrightTestArgs & PlaywrightTestOptions & { databases: V2.Database[] }
  > =>
  async ({ databases }, use) => {
    const database = databases.find(predicate);
    if (!database) {
      throw new Error("Database not found");
    }
    await use(database);
  };

export const listDatabaseSchemasFixture =
  (
    predicate?: (schema: V2.Schema) => boolean,
  ): TestFixture<
    V2.Schema[],
    PlaywrightTestArgs &
      PlaywrightTestOptions & {
        organization: V2.Organization;
        connection: V2.Connection;
        database: V2.Database;
      }
  > =>
  async ({ page, organization, database }, use) => {
    const headers = await getUserHeaders(page);
    const schemas = await retryFn(async function listDatabaseSchemas() {
      const {
        payload: { schemas },
      } = await client.v2
        .listDatabaseSchemas({
          params: {
            org_slug: organization.slug,
            database_slug: database.slug,
          },
          headers,
        })
        .then(extractMessageOrThrow("list_database_schemas"));

      if (!schemas.length) {
        throw new Error("No databases found");
      }
      return schemas;
    }, 10);
    await use(predicate ? schemas.filter(predicate) : schemas);
  };

export const schemaFixture =
  (
    predicate: (schema: V2.Schema) => boolean,
  ): TestFixture<
    V2.Schema,
    PlaywrightTestArgs & PlaywrightTestOptions & { schemas: V2.Schema[] }
  > =>
  async ({ schemas }, use) => {
    const schema = schemas.find(predicate);
    if (!schema) {
      throw new Error("Database not found");
    }
    await use(schema);
  };

export const listSchemaTablesFixture =
  (
    predicate?: (table: V2.Table) => boolean,
  ): TestFixture<
    V2.Table[],
    PlaywrightTestArgs &
      PlaywrightTestOptions & {
        organization: V2.Organization;
        connection: V2.Connection;
        database: V2.Database;
        schema: V2.Schema;
      }
  > =>
  async ({ page, organization, database, schema }, use) => {
    const headers = await getUserHeaders(page);
    const tables = await retryFn(async function listSchemaTables() {
      const {
        payload: { tables },
      } = await client.v2
        .listSchemaTables({
          params: {
            database_slug: database.slug,
            org_slug: organization.slug,
            schema_name: schema.name,
          },
          headers,
        })
        .then(extractMessageOrThrow("list_schema_tables"));
      if (!tables.length) {
        throw new Error("No tables found");
      }
      return tables;
    });
    await use(predicate ? tables.filter(predicate) : tables);
  };

export const tableFixture =
  (
    predicate: (table: V2.Table) => boolean,
  ): TestFixture<
    V2.Table,
    PlaywrightTestArgs & PlaywrightTestOptions & { tables: V2.Table[] }
  > =>
  async ({ tables }, use) => {
    const table = tables.find(predicate);
    if (!table) {
      throw new Error("Table not found");
    }

    await use(table);
  };

export const createIntentQueryFixture: TestFixture<
  Extract<V2.Query, { type: "intent" }>,
  PlaywrightTestArgs &
    PlaywrightTestOptions & {
      organization: V2.Organization;
      database: V2.Database;
      table: V2.Table;
      schema: V2.Schema;
    }
> = async ({ page, organization, database, table, schema }, use) => {
  const headers = await getUserHeaders(page);
  const intentQuery = await retryFn(async function createIntentQuery() {
    const {
      payload: { query: intentQuery },
    } = await client.v2
      .createQuery({
        params: {
          org_slug: organization.slug,
        },
        body: {
          database_slug: database.slug,
          query: {
            name: "e2e test query",
            description: "e2e test description",
            type: "intent",
            intent: {
              dml: "SELECT",
              filters: [{ column: "test_numeric", op: ">", value: "2" }],
              combinator: "AND",
              orders: [{ column: "test_numeric", direction: "DESC" }],
              columns: ["test_numeric"],
              limit: 10,
              schema: schema.name,
              table: table.name,
            },
          },
        },
        headers,
      })
      .then(extractMessageOrThrow("create_query"));

    if (intentQuery.type !== "intent") {
      throw new Error("Invalid query type");
    }
    return intentQuery;
  });

  await use(intentQuery);
};
