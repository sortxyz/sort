import type {
  PlaywrightTestArgs,
  PlaywrightTestOptions,
  TestFixture,
} from "@playwright/test";
import { test as base, expect } from "@playwright/test";
import type { V2 } from "@sort/sdk";
import { randomUUID } from "node:crypto";
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

export const columns: TestFixture<
  V2.Column[],
  PlaywrightTestArgs &
    PlaywrightTestOptions & {
      organization: V2.Organization;
      database: V2.Database;
      table: V2.Table;
      schema: V2.Schema;
    }
> = async ({ page, table, organization, database, schema }, use) => {
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
  await use(columns);
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
  table: V2.Table;
  tables: V2.Table[];
  schema: V2.Schema;
  schemas: V2.Schema[];
}>({
  columns,
  connection: createConnectionFixture,
  database: databaseFixture((db) => db.name === "neondb"),
  databases: listDatabasesFixture(),
  organization: createOrganizationFixture,
  queryResult,
  schema: schemaFixture((schema) => schema.name === "test"),
  schemas: listDatabaseSchemasFixture(),
  table: tableFixture((table) => table.name === "change_request_test"),
  tables: listSchemaTablesFixture(),
});

test("can view data explorer", async ({
  page,
  table,
  organization,
  database,
  schema,
}) => {
  test.slow();
  await page.goto(
    `/orgs/${organization.slug}/databases/${database.slug}/explorer/schemas/${schema.name}/tables/${table.name}`,
  );
  await expect(page.getByRole("row")).toHaveCount(5);
  page
    .getByRole("list")
    .getByRole("link", { name: "change_request_test", exact: true });
});

test.describe("intent queries", () => {
  test("can add two filters", async ({
    page,
    table,
    organization,
    database,
    schema,
  }) => {
    test.slow();
    await page.goto(
      `/orgs/${organization.slug}/databases/${database.slug}/explorer/schemas/${schema.name}/tables/${table.name}`,
    );
    await expect(page.getByRole("row")).toHaveCount(5);

    const filtersBtn = page.getByRole("button", { name: "Filters" });

    const dialog = page.getByRole("dialog");
    await filtersBtn.click();
    await dialog.waitFor();

    const filters = [
      { column: "test_text", operator: "=", value: "E2E tests!" },
      { column: "test_numeric", operator: ">", value: "1" },
    ];

    for (let i = 0; i < filters.length; i++) {
      const filter = filters[i]!;
      await dialog.getByRole("button", { name: "Add Filter" }).click();
      await dialog.getByLabel("Column").nth(i).selectOption(filter.column);
      await dialog.getByLabel("Operator").nth(i).selectOption(filter.operator);
      await dialog.getByLabel("Value").nth(i).fill(filter.value);
    }
    await dialog.getByRole("button", { name: "Update" }).click();
    await dialog.waitFor({ state: "hidden" });

    await expect(page.getByRole("row")).toHaveCount(2);
    await expect(filtersBtn).toHaveText("Filters 2");
    await expect(
      page.getByRole("row").nth(1).getByRole("cell", { name: "test_text" }),
    ).toBeVisible();
    await expect(
      page.getByRole("row").nth(1).getByRole("cell", { name: "test_numeric" }),
    ).toBeVisible();

    // remove filter
    await filtersBtn.click();
    await dialog.getByRole("button", { name: "Remove Filter" }).nth(1).click();
    await dialog.getByRole("button", { name: "Update" }).click();
    await dialog.waitFor({ state: "hidden" });

    await expect(page.getByRole("row")).toHaveCount(2);
    await expect(filtersBtn).toHaveText("Filters 1");
  });

  test("can add two sort orders", async ({
    page,
    table,
    organization,
    database,
    schema,
  }) => {
    test.slow();
    await page.goto(
      `/orgs/${organization.slug}/databases/${database.slug}/explorer/schemas/${schema.name}/tables/${table.name}`,
    );
    await expect(page.getByRole("row")).toHaveCount(5);

    await page.getByRole("button", { name: "test_uuid" }).click();
    await page
      .getByRole("link", { name: "Loading... Data Explorer" })
      .waitFor();
    await page
      .getByRole("link", { name: "Data Explorer", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "test_uuid" }).click();
    await page
      .getByRole("link", { name: "Loading... Data Explorer" })
      .waitFor();
    await page
      .getByRole("link", { name: "Data Explorer", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "test_text" }).click();
    await page
      .getByRole("link", { name: "Loading... Data Explorer" })
      .waitFor();
    await page
      .getByRole("link", { name: "Data Explorer", exact: true })
      .waitFor();

    await expect(page.getByRole("row")).toHaveCount(5);

    await expect(
      page.getByRole("columnheader", { name: "test_uuid" }),
    ).toHaveAttribute("aria-sort", "descending");
    await expect(
      page.getByRole("columnheader", { name: "test_text" }),
    ).toHaveAttribute("aria-sort", "ascending");
  });

  test("can add / remove columns", async ({
    page,
    table,
    organization,
    database,
    schema,
  }) => {
    test.slow();
    await page.goto(
      `/orgs/${organization.slug}/databases/${database.slug}/explorer/schemas/${schema.name}/tables/${table.name}`,
    );
    await expect(page.getByRole("row")).toHaveCount(5);

    const rows = page.getByRole("row");

    // Verify initial column count (7 columns + 1 for the select all checkbox)
    await expect(rows.first().getByRole("columnheader")).toHaveCount(8);

    const filtersButton = page.getByRole("button", { name: "Filters" });
    const dialog = page.getByRole("dialog");

    // Open the filters dialog and switch to the Columns tab
    await filtersButton.click();
    await dialog.waitFor();
    await dialog.getByRole("tab", { name: "Columns" }).click();

    // Uncheck the "id" column to remove it
    await dialog.getByLabel("id", { exact: true }).uncheck();
    await dialog.getByRole("button", { name: "Update" }).click();
    await dialog.waitFor({ state: "hidden" });

    // Verify the column count after removing one column (6 columns)
    // because without all primary keys, the select all checkbox is hidden
    await expect(rows.first().getByRole("columnheader")).toHaveCount(6);
    await expect(rows).toHaveCount(5);

    // Reopen the filters dialog and switch to the Columns tab
    await filtersButton.click();
    await dialog.waitFor();
    await dialog.getByRole("tab", { name: "Columns" }).click();

    // Check the "id" column to add it back
    await dialog.getByLabel("id", { exact: true }).check();
    await dialog.getByRole("button", { name: "Update" }).click();
    await dialog.waitFor({ state: "hidden" });

    // Verify the column count after adding the column back (7 columns + 1 for the select all checkbox)
    await expect(rows.first().getByRole("columnheader")).toHaveCount(8);
    await expect(rows).toHaveCount(5);
  });

  test("can be saved", async ({
    page,
    table,
    organization,
    database,
    schema,
  }) => {
    test.slow();
    await page.goto(
      `/orgs/${organization.slug}/databases/${database.slug}/explorer/schemas/${schema.name}/tables/${table.name}`,
    );
    await expect(page.getByRole("row")).toHaveCount(5);

    // define filter for value slightly above the lowest value
    const dialog = page.getByRole("dialog");

    await page.getByRole("button", { name: "Filters" }).click();
    await dialog.waitFor();
    await dialog.getByRole("button", { name: "Add Filter" }).click();
    await dialog.getByLabel("Column").nth(0).selectOption("test_numeric");
    await dialog.getByLabel("Operator").nth(0).selectOption(">");
    await dialog.getByLabel("Value").nth(0).fill("2.05");
    await dialog.getByRole("button", { name: "Update" }).click();
    await dialog.waitFor({ state: "hidden" });

    // define a sort order by the same column
    await page.getByRole("button", { name: "test_numeric numeric" }).click();
    await page
      .getByRole("link", { name: "Loading... Data Explorer" })
      .waitFor();
    await page
      .getByRole("link", { name: "Data Explorer", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "test_numeric numeric" }).click();
    await page
      .getByRole("link", { name: "Loading... Data Explorer" })
      .waitFor();
    await page
      .getByRole("link", { name: "Data Explorer", exact: true })
      .waitFor();

    // save the query
    const queryName = "test query";
    const queryDesc = "test description";
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByLabel("Name").fill(queryName);
    await page.getByLabel("Description").fill(queryDesc);

    await page.getByRole("button", { name: "Save Query" }).click();
    await dialog.waitFor({ state: "hidden" });

    // confirm result
    await page.getByRole("alert", { name: "Success" }).waitFor();

    await expect(page.getByRole("row")).toHaveCount(3);

    await expect(page.getByRole("table")).toHaveAccessibleName(queryName);

    await page.getByRole("button", { name: "Info" }).click();

    await expect(page.getByRole("table")).toHaveAccessibleDescription(
      queryDesc,
    );
  });
});

test.describe("SQL queries", () => {
  test("can be run", async ({
    page,
    table,
    organization,
    database,
    columns,
    schema,
  }) => {
    test.slow();
    await page.goto(
      `/orgs/${organization.slug}/databases/${database.slug}/explorer/schemas/${schema.name}/tables/${table.name}`,
    );
    await expect(page.getByRole("row")).toHaveCount(5);

    const sqlTextbox = page.getByLabel("SQL Query");
    const sqlBtn = page.getByRole("button", { name: "SQL" });

    await sqlTextbox.waitFor({ state: "hidden" });
    await sqlBtn.click();
    await page
      .getByRole("status", { name: "Loading..." })
      .waitFor({ state: "visible" });
    await sqlTextbox.clear();
    await sqlTextbox.fill(
      `SELECT ${columns[0]?.name} FROM "${schema.name}"."${table.name}" LIMIT 1`,
    );
    await page.getByRole("button", { name: "Run" }).click();

    const rows = page.getByRole("row");
    await expect(rows).toHaveCount(2);
    await expect(rows.first().getByRole("columnheader")).toHaveCount(1);

    // reset toggles back to intent query
    await page.getByRole("link", { name: "Reset" }).click();
    await expect(rows.first().getByRole("columnheader")).toHaveCount(8);
    await expect(rows).toHaveCount(5);
  });

  test("can be saved", async ({
    page,
    table,
    organization,
    database,
    columns,
    schema,
  }) => {
    test.slow();
    await page.goto(
      `/orgs/${organization.slug}/databases/${database.slug}/explorer/schemas/${schema.name}/tables/${table.name}`,
    );
    await expect(page.getByRole("row")).toHaveCount(5);

    const sqlTextbox = page.getByLabel("SQL Query");
    const sqlBtn = page.getByRole("button", { name: "SQL" });

    const rows = page.getByRole("row");

    // save the query
    await sqlBtn.click();
    await sqlTextbox.clear();
    await sqlTextbox.fill(
      `SELECT ${columns[0]?.name} FROM "${schema.name}"."${table.name}" LIMIT 1`,
    );
    await page.getByRole("button", { name: "Run" }).click();

    await page.getByRole("status").waitFor({ state: "visible" });

    await page.getByRole("status").waitFor({ state: "hidden" });

    await expect(rows).toHaveCount(2);
    await expect(rows.first().getByRole("columnheader")).toHaveCount(1);
    const queryName = "test sql query";
    const queryDesc = "test sql description";
    const dialog = page.getByRole("dialog");
    await page.getByRole("button", { name: "Save" }).click();
    await dialog.waitFor();

    await dialog.getByLabel("Name").fill(queryName);
    await dialog.getByLabel("Description").fill(queryDesc);
    await dialog.getByRole("button", { name: "Save Query" }).click();
    await dialog.waitFor({ state: "hidden" });

    // confirm result
    await page.getByRole("alert", { name: "Success" }).waitFor();
    await expect(page.getByRole("row")).toHaveCount(2);
    await expect(page.getByRole("table")).toHaveAccessibleName(queryName);
    await page.getByRole("button", { name: "Info" }).click();
    await expect(page.getByRole("table")).toHaveAccessibleDescription(
      queryDesc,
    );
  });
});

test("editing a row includes the existing values", async ({
  page,
  table,
  organization,
  database,
  schema,
}) => {
  test.slow();
  await page.goto(
    `/orgs/${organization.slug}/databases/${database.slug}/explorer/schemas/${schema.name}/tables/${table.name}`,
  );
  await expect(page.getByRole("row")).toHaveCount(5);

  const dialog = page.getByRole("dialog");
  await page.getByRole("button", { name: "Filters" }).click();
  await dialog.waitFor();

  await dialog.getByRole("tab", { name: "Columns" }).click();

  await dialog.getByLabel("test_boolean").uncheck();
  await dialog.getByLabel("test_jsonb").uncheck();
  await dialog.getByRole("button", { name: "Update" }).click();
  await dialog.waitFor({ state: "hidden" });

  await expect(page.getByRole("row")).toHaveCount(5);

  await expect(
    page.getByRole("button", { name: "Propose Changes" }),
  ).toBeDisabled();
  await page
    .getByRole("row")
    .nth(3)
    .getByRole("cell", { name: "test_numeric" })
    .getByRole("combobox")
    .fill("2.2");
  await page.getByRole("button", { name: "Propose 1 Change" }).click();
  await page.getByRole("dialog").waitFor();
  await page.getByRole("dialog").getByLabel("Title").fill("test");
  await page.getByRole("button", { name: "Create Change Request" }).click();
  await page.waitForURL(
    new RegExp(
      `\\/orgs\\/${organization.slug}\\/databases\\/${database.slug}\\/change-requests\\/\\d+`,
    ),
  );
  // TODO: this is a hack, due to playwright not having support for top layers (dialogs).
  await page.reload();
  await expect(page.getByRole("heading", { name: "test" })).toBeVisible();
});

test("can add a row when not all fields are selected", async ({
  page,
  organization,
  database,
  table,
  schema,
}) => {
  // TODO: fix this test on monday.
  test.slow();
  await page.goto(
    `/orgs/${organization.slug}/databases/${database.slug}/explorer/schemas/${schema.name}/tables/${table.name}`,
  );
  await page.getByRole("button", { name: "Filters" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await dialog.getByRole("tab", { name: "Columns" }).click();

  await dialog.getByLabel("test_jsonb").uncheck();
  await dialog.getByLabel("test_text").uncheck();
  await dialog.getByLabel("test_timestamp").uncheck();
  await dialog.getByRole("button", { name: "Update" }).click();
  await dialog.waitFor({ state: "hidden" });

  await page.getByRole("button", { name: "Add Selected Rows" }).click();

  await page
    .getByRole("row")
    .last()
    .getByRole("cell", { name: "id" })
    .getByRole("textbox")
    .fill(randomUUID());

  await page.getByRole("button", { name: "Propose 1 Change" }).click();
  await page.getByRole("dialog").waitFor();
  await page.getByRole("dialog").getByLabel("Title").fill("test");
  await page.getByRole("button", { name: "Create Change Request" }).click();
  await page.waitForURL(
    new RegExp(
      `\\/orgs\\/${organization.slug}\\/databases\\/${database.slug}\\/change-requests\\/\\d+`,
    ),
  );

  await page.reload();
  await expect(page.getByRole("heading", { name: "test" })).toBeVisible();
});
