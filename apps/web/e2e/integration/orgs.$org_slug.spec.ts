import { faker } from "@faker-js/faker";
import { test as base, expect } from "@playwright/test";
import type { V2 } from "@sort/sdk";
import { matchPath } from "react-router";
import { client, createOrganizationFixture } from "../fixtures";
import { getUserHeaders, toSlugString } from "../utils";

export const test = base.extend<{
  organization: V2.Organization;
}>({
  organization: createOrganizationFixture,
});

test("404 page helps user to create it", async ({ page }) => {
  const slug = faker.lorem.slug();
  await page.goto(`/orgs/${slug}`);
  await page.getByRole("heading", { name: "404" }).waitFor();
  await page.getByRole("link", { name: "Create It" }).click();
  await page.getByLabel("Name").waitFor();
  await expect(page.getByLabel("Name")).toHaveValue(slug);
});

test("it can be created", async ({ page }) => {
  const name = faker.company.name();
  const description = faker.lorem.paragraph();
  const link = faker.internet.url();
  await page.goto("/my/orgs");
  await page
    .getByRole("article")
    .getByRole("link", { name: "Add Organization" })
    .click();
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Description").fill(description);
  await page.getByLabel("Link").fill(link);
  await page.getByRole("button", { name: "Create Organization" }).click();

  // If the slug is already taken, retry with a new slug
  test.fail(
    await page.getByText("Organization slug already exists.").isVisible(),
    "Organization slug already exists.",
  );

  await page.getByRole("alert", { name: "Success" }).waitFor();
  const headers = await getUserHeaders(page);
  const match = matchPath(
    {
      path: "/orgs/:org_slug",
      end: false,
    },
    new URL(page.url()).pathname,
  );
  expect(match).not.toBeNull();
  await client.v2.removeOrganization({
    params: match!.params as { org_slug: string },
    headers,
  });
});

test("can view organization", async ({ page, organization }) => {
  await page.goto(`/orgs/${organization.slug}`);
  await page.getByRole("link", { name: organization.name }).first().waitFor();
  if (organization.description) {
    await page.getByText(organization.description).waitFor();
  }
  if (organization.link) {
    await page.getByText(new URL(organization.link).hostname).waitFor();
  }
});

test("can view on orgs page", async ({ page, organization }) => {
  await page.goto("/my/orgs");
  await page
    .getByRole("row", {
      name: organization.name,
    })
    .getByRole("link", { name: "View Organization" })
    .waitFor();
});

test("can update", async ({ page, organization }) => {
  await page.goto(`/orgs/${organization.slug}/settings`);
  organization.name = faker.company.name();
  organization.slug = toSlugString(organization.name);
  organization.banner = faker.lorem.sentence();
  organization.slack_webhook_url =
    "https://hooks.slack.com/services/123/ABC/XYZ";
  organization.discord_webhook_url =
    "https://discord.com/api/webhooks/123/SBkN";
  await page.getByLabel("Name").fill(organization.name);
  await page.getByLabel("Slug").fill(organization.slug);
  await page.getByLabel("Banner").fill(organization.banner);
  await page
    .getByLabel("Discord Webhook URL")
    .fill(organization.discord_webhook_url);
  await page
    .getByLabel("Slack Webhook URL")
    .fill(organization.slack_webhook_url);
  if (organization.description) {
    await page.getByLabel("Description").fill(organization.description);
  }
  if (organization.link) {
    await page.getByLabel("Link").fill(organization.link);
  }
  await page.getByRole("button", { name: "Update Organization" }).click();

  test.fail(
    await page.getByText("Organization slug already exists.").isVisible(),
    "Organization slug already exists.",
  );

  await page.getByRole("alert", { name: "Success" }).waitFor();

  // confirm updates were saved
  await page.goto(`/orgs/${organization.slug}/settings`);
  await expect(page.getByLabel("Name")).toHaveValue(organization.name);
  await expect(page.getByLabel("Slug")).toHaveValue(organization.slug);
  await expect(page.getByLabel("Banner")).toHaveValue(organization.banner);
  await expect(page.getByLabel("Discord Webhook URL")).toHaveValue(
    organization.discord_webhook_url,
  );
  await expect(page.getByLabel("Slack Webhook URL")).toHaveValue(
    organization.slack_webhook_url,
  );
  if (organization.description) {
    await expect(page.getByLabel("Description")).toHaveValue(
      organization.description,
    );
  }
  if (organization.link) {
    await expect(page.getByLabel("Link")).toHaveValue(organization.link);
  }

  // remove some values and confirm
  await page.getByLabel("Banner").fill("");
  await page.getByLabel("Discord Webhook URL").fill("");
  await page.getByLabel("Slack Webhook URL").fill("");

  await page.getByRole("button", { name: "Update Organization" }).click();
  test.fail(
    await page.getByText("Organization slug already exists.").isVisible(),
    "Organization slug already exists.",
  );
  await page.getByRole("alert", { name: "Success" }).waitFor();

  await page.goto(`/orgs/${organization.slug}/settings`);
  await expect(page.getByLabel("Banner")).toHaveValue("");
  await expect(page.getByLabel("Discord Webhook URL")).toHaveValue("");
  await expect(page.getByLabel("Slack Webhook URL")).toHaveValue("");
});

test("can remove", async ({ page, organization }) => {
  await page.goto(`/orgs/${organization.slug}/settings`);
  await page.getByRole("button", { name: "Remove Organization" }).click();

  const reAuthDialog = page.getByRole("alertdialog", {
    name: "Re-authenticate account",
  });
  await reAuthDialog.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("Email address").fill(process.env.TEST_USER_EMAIL!);
  await page.getByLabel("Password").fill(process.env.TEST_USER_PASSWORD!);
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  const removeDialog = page.getByRole("alertdialog", {
    name: "Remove Organization",
  });
  await removeDialog.waitFor();
  await removeDialog.getByLabel("Slug").fill(organization.slug);
  await removeDialog
    .getByRole("button", { name: "Remove Organization" })
    .click();
  await page.getByRole("alert", { name: "Success" }).waitFor();
});
