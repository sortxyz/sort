import { test } from "@playwright/test";

test("has heading and log out button", async ({ page }) => {
  await page.goto("/my/orgs");
  await page.getByRole("button", { name: "My Account" }).waitFor();
});

// run this locally if you want to cleanup orgs
// test("can delete all orgs", async ({ page }) => {
//   test.setTimeout(120_000_000);
//   await page.goto("/my/orgs");
//   const links = await page
//     .getByRole("link", { name: "View Organization" })
//     .all();
//   for (const link of links) {
//     const href = await link.getAttribute("href");
//     console.log({ href });
//     if (
//       href === "/orgs/heckmann-s-testing" ||
//       href === "/orgs/sort" ||
//       href === "/orgs/sort-playground"
//     ) {
//       continue;
//     }
//     await page.waitForTimeout(5000);
//     await link.click();
//     await page.getByRole("link", { name: "Settings" }).click({ delay: 300 });
//     const slug = await page.getByLabel("Slug").inputValue();

//     await page.getByRole("button", { name: "Remove Organization" }).click();
//     await page.getByRole("button", { name: "Continue" }).click({ delay: 300 });
//     await page.getByLabel("Email").fill(process.env.TEST_USER_EMAIL!);
//     await page.getByLabel("Password").fill(process.env.TEST_USER_PASSWORD!);
//     await page.getByRole("button", { name: "Continue", exact: true }).click();
//     await page.getByRole("alertdialog").getByLabel("Slug").fill(slug);
//     await page
//       .getByRole("alertdialog")
//       .getByRole("button", { name: "Remove Organization" })
//       .click();
//   }
// });
