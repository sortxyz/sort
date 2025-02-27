import type {
  PlaywrightTestArgs,
  PlaywrightTestOptions,
  TestFixture,
} from "@playwright/test";
import { test as base, expect } from "@playwright/test";
import type { V2 } from "@sort/sdk";
import {
  client,
  createConnectionFixture,
  createOrganizationFixture,
  databaseFixture,
  listDatabaseSchemasFixture,
  listDatabasesFixture,
  listSchemaTablesFixture,
  schemaFixture,
  tableFixture,
} from "../fixtures";
import { extractMessageOrThrow, getUserHeaders } from "../utils";

export const columns =
  (
    predicate?: (column: V2.Column) => boolean,
  ): TestFixture<
    V2.Column[],
    PlaywrightTestArgs &
      PlaywrightTestOptions & {
        organization: V2.Organization;
        database: V2.Database;
        table: V2.Table;
        schema: V2.Schema;
      }
  > =>
  async ({ page, table, organization, database, schema }, use) => {
    const headers = await getUserHeaders(page);
    const {
      payload: { columns },
    } = await client.v2
      .listTableColumns({
        params: {
          database_slug: database.slug,
          org_slug: organization.slug,
          schema_name: schema.name,
          table_name: table.name,
        },
        headers,
      })
      .then(extractMessageOrThrow("list_table_columns"));
    await use(predicate ? columns.filter(predicate) : columns);
  };

const queryResult: TestFixture<
  V2.QueryResult,
  PlaywrightTestArgs &
    PlaywrightTestOptions & {
      database: V2.Database;
      table: V2.Table;
      columns: V2.Column[];
      organization: V2.Organization;
      schema: V2.Schema;
    }
> = async ({ page, table, columns, organization, database, schema }, use) => {
  const headers = await getUserHeaders(page);
  const {
    payload: { result },
  } = await client.v2
    .runQuery({
      params: {
        org_slug: organization.slug,
      },
      body: {
        database_slug: database.slug,
        query: {
          intent: {
            columns: columns.map(({ name }) => name),
            combinator: "AND",
            dml: "SELECT",
            filters: [],
            limit: 40,
            orders: [{ column: "test_uuid", direction: "DESC" }],
            schema: schema.name,
            table: table.name,
          },
          type: "intent",
        },
      },
      headers,
    })
    .then(extractMessageOrThrow("run_query"));
  await use(result);
};

const test = base.extend<{
  columns: V2.Column[];
  connection: V2.Connection;
  database: V2.Database;
  databases: V2.Database[];
  organization: V2.Organization;
  queryResult: V2.QueryResult;
  schema: V2.Schema;
  schemas: V2.Schema[];
  table: V2.Table;
  tables: V2.Table[];
}>({
  columns: columns(),
  connection: createConnectionFixture,
  database: databaseFixture(() => true),
  databases: listDatabasesFixture(),
  organization: createOrganizationFixture,
  queryResult,
  schema: schemaFixture(() => true),
  schemas: listDatabaseSchemasFixture(),
  table: tableFixture(() => true),
  tables: listSchemaTablesFixture(),
});

test.describe("Describe Changes", () => {
  test.skip(process.env.TEST_RUN_AI_SUITE !== "1", "Skipping AI tests...");

  test("can run one ADD change request statement", async ({
    page,
    organization,
    database,
    tables,
  }) => {
    const schema = "test";
    const tableName = "change_request_test";
    const table = tables.find((t) => t.name === tableName)!;

    test.slow();
    await page.goto(
      `/orgs/${organization.slug}/databases/${database.slug}/explorer/schemas/${schema}/tables/${table.name}`,
    );
    const rowCount = await page.getByRole("row").count();
    expect(rowCount).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Describe Changes" }).click();

    await page
      .getByLabel("Message")
      .fill("generate a change request test record with some random data");
    await page.getByRole("button", { name: "View Results" }).click();
    await page.getByRole("status").waitFor();
    await page
      .getByRole("status")
      .waitFor({ state: "hidden", timeout: 60_000 });
    expect(await page.getByRole("row").count()).toBeGreaterThan(rowCount);
  });

  test("can run one MODIFY change request statement", async ({
    page,
    organization,
    database,
    tables,
  }) => {
    const schema = "test";
    const tableName = "change_request_test";
    const table = tables.find((t) => t.name === tableName)!;

    test.slow();
    await page.goto(
      `/orgs/${organization.slug}/databases/${database.slug}/explorer/schemas/${schema}/tables/${table.name}`,
    );
    expect(await page.getByRole("row").count()).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Describe Changes" }).click();

    const testBooleanValues = await page
      .getByRole("cell", { name: "test_boolean" })
      .all()
      .then((cells) =>
        Promise.all(cells.map((cell) => cell.locator("input").inputValue())),
      );

    await page
      .getByLabel("Message")
      .fill(
        "Modify a random record with test_boolean to FALSE that is not already FALSE.",
      );
    await page.getByRole("button", { name: "View Results" }).click();
    await page.getByRole("status").waitFor();
    await page
      .getByRole("status")
      .waitFor({ state: "hidden", timeout: 60_000 });
    expect(
      await page
        .getByRole("cell", { name: "test_boolean" })
        .evaluateAll((cells) =>
          cells.map((cell) => cell.querySelector("input")?.value),
        ),
    ).not.toEqual(testBooleanValues);
  });

  test("can run one DELETE change request statement", async ({
    page,
    organization,
    database,
  }) => {
    test.slow();
    await page.goto(
      `/orgs/${organization.slug}/databases/${database.slug}/explorer/schemas/test/tables/change_request_test`,
    );
    expect(await page.getByRole("row").count()).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Describe Changes" }).click();
    await page
      .getByLabel("Message")
      .fill("delete a random change request test record");
    await page.getByRole("button", { name: "View Results" }).click();
    await page.getByRole("status").waitFor();
    await page
      .getByRole("status")
      .waitFor({ state: "hidden", timeout: 60_000 });

    await expect(
      page.getByRole("table").getByRole("button", { name: "×" }),
    ).toBeVisible();
  });

  test("delete with minimal info", async ({ page, organization, database }) => {
    test.slow();
    await page.goto(
      `/orgs/${organization.slug}/databases/${database.slug}/explorer/schemas/pushcash_test/tables/clients`,
    );
    expect(await page.getByRole("row").count()).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Describe Changes" }).click();

    await page.getByLabel("Message").fill("delete id 3");
    await page.getByRole("button", { name: "View Results" }).click();
    await page.getByRole("status").waitFor();
    await page
      .getByRole("status")
      .waitFor({ state: "hidden", timeout: 60_000 });

    await expect(
      page.getByRole("table").getByRole("button", { name: "×" }),
    ).toBeVisible();
  });

  test("update with minimal info", async ({ page, organization, database }) => {
    test.slow();
    await page.goto(
      `/orgs/${organization.slug}/databases/${database.slug}/explorer/schemas/pushcash_test/tables/clients`,
    );
    expect(await page.getByRole("row").count()).toBeGreaterThan(0);

    const emailValues = await page
      .getByRole("cell", { name: "email" })
      .all()
      .then((cells) =>
        Promise.all(cells.map((cell) => cell.locator("input").inputValue())),
      );

    await page.getByRole("button", { name: "Describe Changes" }).click();

    await page
      .getByLabel("Message")
      .fill("update Client 5's email to aaron@jason.com");
    await page.getByRole("button", { name: "View Results" }).click();
    await page.getByRole("status").waitFor();
    await page
      .getByRole("status")
      .waitFor({ state: "hidden", timeout: 60_000 });

    expect(
      await page
        .getByRole("cell", { name: "email" })
        .evaluateAll((cells) =>
          cells.map((cell) => cell.querySelector("input")?.value),
        ),
    ).not.toEqual(emailValues);
  });

  test("update with precise info but for beginning of string locator", async ({
    page,
    organization,
    database,
  }) => {
    test.slow();
    await page.goto(
      `/orgs/${organization.slug}/databases/${database.slug}/explorer/schemas/pushcash_test/tables/intents`,
    );
    expect(await page.getByRole("row").count()).toBeGreaterThan(0);

    const currencyValues = await page
      .getByRole("cell", { name: "currency" })
      .all()
      .then((cells) =>
        Promise.all(cells.map((cell) => cell.locator("input").inputValue())),
      );

    await page.getByRole("button", { name: "Describe Changes" }).click();

    await page
      .getByLabel("Message")
      .fill(
        'Update the rows where status starts with "failed" and set the currency column to "EUR".',
      );
    await page.getByRole("button", { name: "View Results" }).click();
    await page.getByRole("status").waitFor();
    await page
      .getByRole("status")
      .waitFor({ state: "hidden", timeout: 60_000 });

    expect(
      await page
        .getByRole("cell", { name: "currency" })
        .evaluateAll((cells) =>
          cells.map((cell) => cell.querySelector("input")?.value),
        ),
    ).not.toEqual(currencyValues);
  });

  test("update with loose criterion", async ({
    page,
    organization,
    database,
  }) => {
    test.slow();
    await page.goto(
      `/orgs/${organization.slug}/databases/${database.slug}/explorer/schemas/pushcash_test/tables/users`,
    );
    expect(await page.getByRole("row").count()).toBeGreaterThan(0);

    const statusValues = await page
      .getByRole("cell", { name: "status" })
      .all()
      .then((cells) =>
        Promise.all(cells.map((cell) => cell.locator("input").inputValue())),
      );

    await page.getByRole("button", { name: "Describe Changes" }).click();

    await page
      .getByLabel("Message")
      .fill(
        "Set the status to 'active' for all users with feminine first names",
      );
    await page.getByRole("button", { name: "View Results" }).click();
    await page.getByRole("status").waitFor();
    await page
      .getByRole("status")
      .waitFor({ state: "hidden", timeout: 60_000 });

    expect(
      await page
        .getByRole("cell", { name: "status" })
        .evaluateAll((cells) =>
          cells.map((cell) => cell.querySelector("input")?.value),
        ),
    ).not.toEqual(statusValues);
  });
});
