import { defineConfig } from "vite-plus";

// Preserve the previous check scope; generated files have their own validators.
const ignorePatterns = [
  "**/node_modules/**",
  "**/coverage/**",
  "**/dist/**",
  "**/cache/**",
  "**/.cache/**",
  "**/.turbo/**",
  "**/.source/**",
  "**/.next/**",
  "**/out/**",
  "**/.claude/**",
  "**/.pi/**",
  "**/.pi-subagents/**",
  "**/.agents/**",
  "**/.codex/**",
  "tools/oxlint/anti-slop/**",
  "**/routeTree.gen.ts",
  "**/env.d.ts",
  "**/uniwind-types.d.ts",
  "**/drizzle/meta/**",
];

export default defineConfig({
  fmt: {
    printWidth: 80,
    useTabs: false,
    sortPackageJson: false,
    ignorePatterns: [
      ...ignorePatterns,
      "**/tsconfig*.json",
      "**/package.json",
      "**/*.{css,svg,html,md,mdx,yaml,yml}",
      "**/package-lock.json",
      // Written by the skills tool with its own indentation.
      "**/skills-lock.json",
    ],
    overrides: [{ files: ["**/*.{json,jsonc}"], options: { useTabs: true } }],
  },
  lint: {
    ignorePatterns,
    plugins: ["typescript", "unicorn", "oxc", "react", "jsx-a11y", "import"],
    categories: { correctness: "error" },
    jsPlugins: [
      { name: "vite-plus", specifier: "vite-plus/oxlint-plugin" },
      { name: "morrow", specifier: "./scripts/lint/morrow-plugin.mjs" },
      { name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" },
    ],
    overrides: [
      {
        // Tools read these through a default export.
        files: [
          "**/*.config.{ts,mjs,js}",
          "scripts/lint/morrow-plugin.mjs",
          "tools/oxlint/**",
          "packages/email/src/templates/**",
          "apps/api/src/index.ts",
          "apps/web/src/routes/__root.tsx",
        ],
        rules: { "import/no-default-export": "off" },
      },
      {
        files: ["**/*.test.{ts,tsx}", "tests/**"],
        rules: {
          "anti-slop/no-chained-type-assertions": "off",
          "anti-slop/no-known-value-widening": "off",
        },
      },
    ],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      "morrow/vertical-boundaries": "error",
      "import/no-default-export": "error",
      "oxc/no-accumulating-spread": "error",
      "anti-slop/no-array-filter-map": "error",
      "anti-slop/no-reduce-accumulator-copy": "error",
      "anti-slop/no-chained-type-assertions": "error",
      "anti-slop/no-known-value-widening": "error",
      "anti-slop/no-module-mocking": "error",
      "anti-slop/no-object-parameters": "error",
      "anti-slop/no-reflect-apply": "error",
      "anti-slop/no-reflect-get": "error",
      // "Shape" is a domain term now (Electric shapes, see CONTEXT.md and
      // docs/adr/0001) and part of Electric's own API (`shapeOptions`).
      "anti-slop/no-shape-in-symbol-names": "off",
      "anti-slop/no-unknown-type-aliases": "error",
      "anti-slop/no-widen-then-assert": "error",
      "no-param-reassign": "error",
      "no-unused-vars": [
        "error",
        {
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "typescript/prefer-as-const": "error",
      "default-param-last": "error",
      "typescript/prefer-enum-initializers": "error",
      "react/self-closing-comp": "error",
      "react/no-danger": "error",
      "react/no-array-index-key": "error",
      "no-template-curly-in-string": "error",
      "no-eval": "error",
      "unicorn/prefer-number-properties": "error",
      "typescript/no-inferrable-types": ["error", { ignoreParameters: true }],
      "no-else-return": "error",
      "react/rules-of-hooks": "error",
      "react/exhaustive-deps": "error",
      // Compiler adoption and stricter accessibility/style policies are separate
      // changes. These Oxlint defaults were not enforced by the Biome baseline.
      "react/set-state-in-effect": "off",
      "react/refs": "off",
      "react/preserve-manual-memoization": "off",
      "react/incompatible-library": "off",
      "react/purity": "off",
      "react/use-memo": "off",
      "jsx-a11y/control-has-associated-label": "off",
      "jsx-a11y/no-autofocus": "off",
      "jsx-a11y/no-noninteractive-element-interactions": "off",
      "jsx-a11y/prefer-tag-over-role": "off",
      "unicorn/no-new-array": "off",
      "unicorn/no-invalid-fetch-options": "off",
      "unicorn/no-useless-spread": "off",
    },
    // Package typechecks cover both web tsconfigs and emitted declarations.
    options: { typeAware: false, typeCheck: false },
  },
  test: {
    maxWorkers: 4,
    projects: [
      "apps/api/vitest.config.ts",
      "apps/web/vitest.config.ts",
      "packages/*/vitest.config.ts",
    ],
  },
});
