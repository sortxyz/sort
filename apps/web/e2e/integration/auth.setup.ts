import { test as setup } from "@playwright/test";
import path from "path";

setup.beforeAll(() => {
  setup.fail(
    process.env.TEST_USER_EMAIL === undefined,
    "TEST_USER_EMAIL is not set",
  );
  setup.fail(
    process.env.TEST_USER_PASSWORD === undefined,
    "TEST_USER_PASSWORD is not set",
  );
});

setup("authenticate", async ({ browser, page }) => {
  // Determine the browser name
  const browserName = browser.browserType().name();
  const authFile = path.join(
    "playwright",
    ".auth",
    `test-user-${browserName}.json`,
  );

  await page.goto("/");
  await page.getByRole("link", { name: "Log in" }).click();

  console.log(
    `\x1b[2m\tLog in as '${process.env.TEST_USER_EMAIL}' using ${browserName}\x1b[0m`,
  );

  await page.getByRole("heading", { name: "Welcome" }).waitFor();

  await page.getByLabel("Email address").fill(process.env.TEST_USER_EMAIL!);
  await page.getByLabel("Password").fill(process.env.TEST_USER_PASSWORD!);

  console.log("\x1b[2m\tLog in processing\x1b[0m");

  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await page.getByRole("button", { name: "My Account" }).waitFor();

  console.log(`\x1b[2m\tLog in processed for ${browserName}\x1b[0m`);

  await page.context().storageState({ path: authFile });
});
