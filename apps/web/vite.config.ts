import path from "node:path";
import babel from "@rolldown/plugin-babel";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { varlockVitePlugin } from "@varlock/vite-integration";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig, lazyPlugins, type Plugin } from "vite-plus";
import packageJson from "../../package.json";

const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
const sentryOrg = process.env.SENTRY_ORG;
const sentryProject = process.env.SENTRY_PROJECT;
const uploadSourceMaps = Boolean(sentryAuthToken && sentryOrg && sentryProject);

/**
 * Preloads the body font. Its file name carries a hash, so the tag is added
 * from the build output. Only the Latin subset: the others load when a page
 * needs their characters.
 */
function preloadBodyFont(): Plugin {
  return {
    name: "morrow:preload-body-font",
    transformIndexHtml: {
      order: "post",
      handler(_html, ctx) {
        const font = Object.keys(ctx.bundle ?? {}).find((name) =>
          /inter-latin-wght-normal-.*\.woff2$/.test(name),
        );
        if (!font) return [];
        return [
          {
            tag: "link",
            attrs: {
              rel: "preload",
              as: "font",
              type: "font/woff2",
              href: `/${font}`,
              crossorigin: "",
            },
            injectTo: "head-prepend",
          },
        ];
      },
    },
  };
}

export default defineConfig({
  run: {
    tasks: {
      compile: {
        command: "vp build",
        dependsOn: [
          { task: "build", from: ["dependencies", "devDependencies"] },
        ],
        cache: false,
      },
      "check:types": {
        command:
          "tsc --noEmit -p tsconfig.app.json && tsc --noEmit -p tsconfig.node.json",
        dependsOn: [
          { task: "build", from: ["dependencies", "devDependencies"] },
        ],
        cache: {
          input: [
            { auto: true },
            ".env*",
            { pattern: ".env*", base: "workspace" },
          ],
          output: [],
        },
      },
      "test:run": {
        command: "vp test run --config vitest.config.ts",
        dependsOn: [
          { task: "build", from: ["dependencies", "devDependencies"] },
        ],
        cache: false,
      },
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  base: "/",
  plugins: lazyPlugins(() => [
    // Dev only (strips the devtools from builds); must come before the others.
    devtools({
      consolePiping: { enabled: true },
      injectSource: { enabled: true },
    }),
    // Loads and validates the root .env.schema; replaces Vite's .env handling.
    varlockVitePlugin(),
    tanstackRouter({
      autoCodeSplitting: true,
      // Keep co-located route tests out of the generated route tree.
      routeFileIgnorePattern: "\\.test\\.tsx?$",
    }),
    tailwindcss(),
    preloadBodyFont(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    // Hidden when Sentry env vars are absent so local dev does not depend on it.
    ...(uploadSourceMaps
      ? [
          sentryVitePlugin({
            authToken: sentryAuthToken,
            org: sentryOrg,
            project: sentryProject,
            release: { name: packageJson.version },
            sourcemaps: { filesToDeleteAfterUpload: ["./dist/**/*.map"] },
          }),
        ]
      : []),
  ]),
  server: {
    host: true,
    hmr: true,
    port: 5173,
    // The API is same-origin in production, so dev proxies to it instead of
    // relying on CORS.
    proxy: {
      "/api": "http://localhost:1337",
      "/rpc": "http://localhost:1337",
      "/.well-known": "http://localhost:1337",
    },
  },
  optimizeDeps: {
    exclude: ["better-auth"],
  },
  ssr: {
    noExternal: ["better-auth"],
  },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Generate maps only for private symbolication, then delete after upload.
    // "hidden" alone still writes publicly servable .map files.
    sourcemap: uploadSourceMaps ? "hidden" : false,
    rolldownOptions: {
      output: {
        // A few stable groups, so a release re-downloads only the app's own
        // code. Each group holds the code of one concern.
        codeSplitting: {
          groups: [
            {
              name: "vendor-react",
              test: /node_modules\/(react|react-dom|scheduler|use-sync-external-store)\//,
            },
            {
              name: "vendor-base-ui",
              test: /node_modules\/(@base-ui|@floating-ui)\//,
            },
            // Session replay stays out: it loads on demand.
            {
              name: "vendor-sentry",
              test: /node_modules\/@sentry\/(?!replay)/,
            },
            {
              name: "vendor-sync",
              test: /node_modules\/(@tanstack\/(db|react-db|electric-db-collection|db-ivm)|@electric-sql\/client)\//,
            },
            // Last: a group also takes the libraries its modules import, so
            // the editor must not claim ones the first render shares.
            {
              name: "vendor-editor",
              test: /node_modules\/(@tiptap|prosemirror-[^/]+|lowlight|highlight\.js)\//,
            },
          ],
        },
      },
    },
    commonjsOptions: {
      include: [/better-auth/, /node_modules/],
      transformMixedEsModules: true,
    },
    target: "esnext",
  },
});
