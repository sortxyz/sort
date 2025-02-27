import { faker } from "@faker-js/faker";
import { test as base } from "@playwright/test";
import type { V2 } from "@sort/sdk";
import {
  createConnectionFixture,
  createOrganizationFixture,
} from "../fixtures";

const test = base.extend<{
  organization: V2.Organization;
  connection: V2.Connection;
}>({
  organization: createOrganizationFixture,
  connection: createConnectionFixture,
});

test.beforeAll(() => {
  test.fail(
    process.env.TEST_DATABASE_URL === undefined,
    "TEST_DATABASE_URL is not set",
  );
});

test("can create with connection string", async ({ page, organization }) => {
  const name = faker.airline.airport().name;
  await page.goto(
    `/orgs/${organization.slug}/settings/connections/add-connection/postgres`,
  );
  await page.getByRole("link", { name: organization.name }).first().waitFor();

  await page.locator("input[name$='connection.name']").fill(name);

  // change our connection type to Connection String
  await page.getByLabel("Connection Type").selectOption("connection_string");
  await page.getByLabel("Connection String").waitFor();

  // enter our connection string
  await page
    .getByLabel("Connection String")
    .fill(process.env.TEST_DATABASE_URL!);

  await page.getByRole("button", { name: "Create Connection" }).click();

  await page.getByRole("alert", { name: "Success" }).waitFor();
});

test("can create with params", async ({ page, organization }) => {
  const databaseUrl = new URL(process.env.TEST_DATABASE_URL!);
  const name = faker.airline.airport().name;
  await page.goto(
    `/orgs/${organization.slug}/settings/connections/add-connection/postgres`,
  );
  await page.getByRole("link", { name: organization.name }).first().waitFor();

  // change our connection type to Params
  await page.getByLabel("Name", { exact: true }).fill(name);

  await page.getByLabel("Connection Type").selectOption("parameters");
  await page.getByLabel("Host").waitFor();

  // enter our connection parameters
  await page
    .locator("input[name$='connection.parameters.host']")
    .fill(databaseUrl.host);

  if (databaseUrl.port) {
    await page
      .locator("input[name$='connection.parameters.port']")
      .fill(databaseUrl.port);
  }

  await page
    .locator("input[name$='connection.parameters.database']")
    .fill(databaseUrl.pathname.slice(1));

  await page
    .locator("input[name$='connection.parameters.user']")
    .fill(databaseUrl.username);

  await page
    .locator("input[name$='connection.parameters.password']")
    .fill(databaseUrl.password);

  await page.getByRole("button", { name: "Create Connection" }).click();

  await page.getByRole("alert", { name: "Success" }).waitFor();
});

test("can re-import schema", async ({ page, organization, connection }) => {
  test.slow();

  await page.goto(`/orgs/${organization.slug}/settings/connections`);

  await page.getByRole("link", { name: connection.name }).click();

  await page.getByRole("button", { name: "Re-import Schema" }).click();

  await page.getByRole("alert", { name: "Success" }).waitFor();
});
