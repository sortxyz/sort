import base, { expect } from "@playwright/test";
import type { V2 } from "@sort/sdk";
import {
  createConnectionFixture,
  createOrganizationFixture,
  databaseFixture,
  listDatabasesFixture,
} from "../fixtures";

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
  connection: createConnectionFixture,
  database: databaseFixture((db) => db.name === "neondb"),
  databases: listDatabasesFixture(),
  organization: createOrganizationFixture,
});

test("change request listing page exists", async ({
  page,
  organization,
  database,
}) => {
  await page.goto(
    `/orgs/${organization.slug}/databases/${database.slug}/change-requests`,
  );
  await expect(
    page.getByRole("heading", { name: "Change Requests", exact: true }),
  ).toBeVisible();
});
