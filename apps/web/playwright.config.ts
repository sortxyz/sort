import { defineConfig, devices } from "@playwright/test";
import path from "path";
/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import * as dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local" });

const browsers = ["chromium", "firefox", "webkit"];

/**
 * Function to get the auth file path for a specific browser
 */
const getAuthFile = (browserName: string) =>
  path.join("playwright", ".auth", `test-user-${browserName}.json`);

const getDeviceName = (browserName: string) => {
  switch (browserName) {
    case "chromium":
      return "Desktop Chrome";
    case "firefox":
      return "Desktop Firefox";
    case "webkit":
      return "Desktop Safari";
    default:
      throw new Error(`Unsupported browser: ${browserName}`);
  }
};

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./e2e/integration",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Use 4 workers on CI. */
  workers: process.env.CI ? 4 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI ? [["github"], ["html"]] : "html",
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    video: "retain-on-failure",
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.TEST_BASE_URL || "http://localhost:3000",
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    contextOptions: {
      reducedMotion: "reduce",
    },
    viewport: { width: 1280, height: 720 },
  },

  /* Configure projects for major browsers */
  projects: [
    ...browsers.map((browserName) => ({
      name: `setup-${browserName}`,
      testMatch: /.*\.setup\.ts/,
      use: {
        ...devices[getDeviceName(browserName)],
      },
    })),
    ...browsers.map((browserName) => ({
      name: browserName,
      use: {
        ...devices[getDeviceName(browserName)],
        storageState: getAuthFile(browserName),
      },
      dependencies: [`setup-${browserName}`],
    })),
  ],

  /* Run your local dev server before starting the tests */
  webServer: process.env.TEST_BASE_URL
    ? undefined
    : {
        command: "pnpm dev",
        port: 3000,
        reuseExistingServer: true,
        stderr: "pipe",
        stdout: "pipe",
      },
});
