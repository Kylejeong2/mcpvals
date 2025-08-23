import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      "dist/**/*",
      "node_modules/**/*",
      "**/*.d.ts",
      "**/*.json",
      "**/*.yml",
      "**/*.yaml",
      "**/*.md",
      ".github/**/*",
      "docs-website/.next/**/*",
      "docs-website/node_modules/**/*",
      "docs-website/next-env.d.ts",
      "docs-website/pnpm-lock.yaml",
    ],
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      ecmaVersion: 2022,
      sourceType: "module",
    },
  },
  {
    files: ["**/*.{jsx,tsx}"],
    ...pluginReact.configs.flat.recommended,
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  {
    files: ["**/*.test.{js,ts,tsx}", "**/*.spec.{js,ts,tsx}", "tests/**/*"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
