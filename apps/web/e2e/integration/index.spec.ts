import { expect, test } from "@playwright/test";
import { retryFn } from "../utils";

test("Check all links for validity", async ({ page, request }) => {
  test.slow();
  // Step 1: Navigate to the root page
  await page.goto("/");
  // Step 2: Gather all unique links
  const hrefs = await page.evaluate(() =>
    Array.from(new Set(Array.from(document.links).map((link) => link.href))),
  );

  // Step 3: Visit each link and check validity
  for (const href of hrefs) {
    if (page.url() === href || href.indexOf(`${page.url()}#`) === 0) {
      console.log(`Skipping URL (same page): ${href}`);
      continue;
    }
    if (href.startsWith("mailto:")) {
      console.log(`Skipping URL (mailto): ${href}`);
      continue;
    }

    try {
      await retryFn(async function validateUrl() {
        const response = await request.get(href, {
          headers: { "user-agent": "8ypass challenge pls" },
        });

        expect(response.status()).toBeLessThan(404);
        console.log(`Valid URL: ${href}`);
      });
    } catch (error) {
      console.error(`Broken URL: ${href} Error: ${String(error)}`);
      throw error;
    }
  }
});
