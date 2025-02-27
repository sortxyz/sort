import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [],
  test: {
    coverage: {
      enabled: true,
      reportsDirectory: path.resolve("./coverage"),
    },
    environment: "jsdom",
    env: {
      TZ: "UTC",
    },
  },
  root: "app",
});
