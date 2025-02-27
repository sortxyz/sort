import { FlatCompat } from "@eslint/eslintrc";
import eslint from "@eslint/js";
import pluginImportX from "eslint-plugin-import-x";
import pluginJsxa11y from "eslint-plugin-jsx-a11y";
import pluginPrettier from "eslint-plugin-prettier/recommended";
import pluginReact from "eslint-plugin-react";
import pluginReactCompiler from "eslint-plugin-react-compiler";
import pluginStorybook from "eslint-plugin-storybook";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/** @type {import('eslint').Linter.Config[]} */
export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  pluginImportX.flatConfigs.recommended,
  pluginImportX.flatConfigs.typescript,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.es2022 },
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "import-x/no-named-as-default-member": "off",
      "import-x/no-named-as-default": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/only-throw-error": [
        "error",
        { allow: ["Response", "TypedResponse"] },
      ],
      "@typescript-eslint/prefer-promise-reject-errors": [
        "error",
        { allowThrowingUnknown: true },
      ],
    },
  },
  {
    files: ["**/*.{js,jsx}"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ["**/*.{jsx,tsx}"],
    rules: {
      "react/prop-types": "off",
      "react-compiler/react-compiler": "error",
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    extends: [
      pluginReact.configs.flat.recommended,
      pluginReact.configs.flat["jsx-runtime"],
      ...compat.extends("plugin:react-hooks/recommended"),
      pluginReactCompiler.configs.recommended,
      pluginJsxa11y.flatConfigs.recommended,
    ],
  },
  {
    files: ["**/*.stories.{js,jsx,ts,tsx,mdx}"],
    ignores: ["!.storybook"],
    extends: [pluginStorybook.configs["flat/recommended"]],
  },
  pluginPrettier,
  {
    ignores: [
      ".react-router",
      ".vercel",
      "build",
      "coverage",
      "playwright-report",
      "public",
      ".storybook",
    ],
  },
);
