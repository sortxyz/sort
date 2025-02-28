import { test as base, expect } from "@playwright/test";
import type { V2 } from "@sort/sdk";
import {
  createConnectionFixture,
  createIntentQueryFixture,
  createOrganizationFixture,
  databaseFixture,
  listDatabaseSchemasFixture,
  listDatabasesFixture,
  listSchemaTablesFixture,
  schemaFixture,
  tableFixture,
} from "../fixtures";

const test = base.extend<{
  connection: V2.Connection;
  database: V2.Database;
  databases: V2.Database[];
  intentQuery: Extract<V2.Query, { type: "intent" }>;
  organization: V2.Organization;
  schema: V2.Schema;
  schemas: V2.Schema[];
  table: V2.Table;
  tables: V2.Table[];
}>({
  connection: createConnectionFixture,
  database: databaseFixture((database) => database.name === "neondb"),
  databases: listDatabasesFixture(),
  intentQuery: createIntentQueryFixture,
  organization: createOrganizationFixture,
  schema: schemaFixture((schema) => schema.name === "test"),
  schemas: listDatabaseSchemasFixture(),
  table: tableFixture((table) => table.name === "change_request_test"),
  tables: listSchemaTablesFixture(),
});

test.describe("Intent Query Operations", () => {
  test("should load and update intent query details", async ({
    page,
    organization,
    database,
    intentQuery,
  }) => {
    test.slow();

    // Navigate to query page
    await page.goto(
      `/orgs/${organization.slug}/databases/${database.slug}/explorer/queries/${intentQuery.id}`,
      { waitUntil: "networkidle" },
    );

    // Verify initial state
    await expect(
      page
        .getByRole("complementary")
        .getByRole("link", { name: intentQuery.name }),
    ).toBeVisible();

    // Open info panel
    await page.getByRole("button", { name: "Info" }).click();

    // Verify description
    await page.getByText(intentQuery.description!).waitFor();

    // Update query details
    const queryName = `${intentQuery.name} changed`;
    const queryDesc = `${intentQuery.description!} changed`;

    await page.getByRole("button", { name: "Update" }).click();
    await page.getByLabel("Name").fill(queryName);
    await page.getByLabel("Description").fill(queryDesc);
    await page.getByRole("button", { name: "Update Query" }).click();

    // Verify success message
    await page.getByRole("alert", { name: "Success" }).waitFor();

    // Verify updates are reflected
    await expect(page.getByRole("table")).toHaveAccessibleName(queryName);

    // Open info panel
    await page.getByRole("button", { name: "Info" }).click();
    await page.getByText(queryDesc).waitFor();
    await expect(page.getByRole("table")).toHaveAccessibleDescription(
      queryDesc,
    );
  });
});
