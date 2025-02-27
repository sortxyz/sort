import { faker } from "@faker-js/faker";
import { test } from "@playwright/test";

test("can change email address", async ({ page }) => {
  await page.goto("/my/profile");
  await page.getByRole("heading", { name: "Account Settings" }).waitFor();
  await page.getByLabel("Email").fill(faker.internet.email());
  await page.getByRole("button", { name: "Update Profile" }).click();
  await page.getByRole("alert", { name: "Success" }).waitFor();
});

test("can resend confirmation email", async ({ page }) => {
  await page.goto("/my/profile");
  await page.getByRole("heading", { name: "Account Settings" }).waitFor();
  await page.getByRole("button", { name: "Re-send Email" }).waitFor();
  await page.getByRole("button", { name: "Re-send Email" }).click();
  await page.getByRole("alert", { name: "Success" }).waitFor();
});
