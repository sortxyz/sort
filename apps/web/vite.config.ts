import { reactRouter } from "@react-router/dev/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import legacy from "@vitejs/plugin-legacy";
import { dirname } from "path";
import { reactRouterDevTools } from "react-router-devtools";
import { fileURLToPath } from "url";
import type { PluginOption } from "vite";
import { defineConfig } from "vite";
// import unusedCode from "vite-plugin-unused-code";
import babel from "vite-plugin-babel";
import tsconfigPaths from "vite-tsconfig-paths";

const plugins: PluginOption[] = [tsconfigPaths()];
const isStorybook = process.argv[1]?.includes("storybook");

if (!isStorybook) {
  plugins.unshift(reactRouter());
  plugins.push(
    babel({
      filter: /\.[jt]sx?$/,
      babelConfig: {
        presets: ["@babel/preset-typescript"], // if you use TypeScript
        plugins: [["babel-plugin-react-compiler", { target: "18" }]],
      },
    }),
  );
  plugins.unshift(reactRouterDevTools());
  plugins.push(legacy({ targets: ["defaults", "not IE 11"] }));
  if (process.env.SENTRY_AUTH_TOKEN) {
    // Put the Sentry vite plugin after all other plugins
    plugins.push(
      sentryVitePlugin({
        sourcemaps: {
          filesToDeleteAfterUpload: ["**/*.map"],
        },
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
      }) as PluginOption,
    );
  }

  // Use for finding unused code in the app
  // plugins.push(
  //   unusedCode({
  //     patterns: ["app/**/*.*"],
  //   }),
  // );
}

export default defineConfig({
  build: {
    assetsInlineLimit: 0,
    sourcemap: "hidden",
  },
  server: {
    warmup: {
      ssrFiles: [
        "./app/**/*.server.ts",
        "./app/**/*.server.tsx",
        "./app/entry.server.tsx",
        "./app/root.tsx",
        "./app/routes/**/*.tsx",
      ],
      clientFiles: [
        "./app/**/*.client.ts",
        "./app/**/*.client.tsx",
        "./app/entry.client.tsx",
        "./app/root.tsx",
        "./app/routes/**/*.tsx",
      ],
    },
    port: 3000,
    fs: {
      // Restrict files that could be served by Vite's dev server.  Accessing
      // files outside this directory list that aren't imported from an allowed
      // file will result in a 403.  Both directories and files can be provided.
      // If you're comfortable with Vite's dev server making any file within the
      // project root available, you can remove this option.  See more:
      // https://vitejs.dev/config/server-options.html#server-fs-allow
      allow: [
        "app",
        dirname(fileURLToPath(import.meta.resolve("react-router-devtools"))),
      ],
    },
  },
  plugins,
});
