import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import test from "node:test";
import plugin from "./morrow-plugin.mjs";

const root = resolve(import.meta.dirname, "../..");
const rule = plugin.rules["vertical-boundaries"];

/** Reports produced by importing `specifier` from `file` (repo-relative). */
function check(file, specifier, visitor = "ImportDeclaration") {
  const reports = [];
  const handlers = rule.create({
    filename: join(root, file),
    report: (report) => reports.push(report.message),
  });
  handlers[visitor]?.({ source: { value: specifier, type: "Literal" } });
  return reports;
}

test("another vertical is reachable through its index", () => {
  assert.deepEqual(
    check("apps/api/src/members/lifecycle.ts", "../activity"),
    [],
  );
  assert.deepEqual(
    check("apps/api/src/members/lifecycle.ts", "../activity/index"),
    [],
  );
  assert.deepEqual(check("apps/web/src/onboarding/x.tsx", "@/workspace"), []);
});

test("reaching into another vertical's internals is reported", () => {
  const reports = check(
    "apps/api/src/members/lifecycle.ts",
    "../activity/publish-workspace-activity",
  );
  assert.equal(reports.length, 1);
  assert.match(reports[0], /"activity" vertical/);
  assert.equal(
    check("apps/web/src/onboarding/x.tsx", "@/workspace/use-active-workspace")
      .length,
    1,
  );
});

test("a vertical may import its own files", () => {
  assert.deepEqual(
    check("apps/api/src/members/lifecycle.ts", "./handle-member-removed"),
    [],
  );
  assert.deepEqual(check("apps/web/src/members/x.tsx", "@/members/types"), []);
});

test("platform, app and design-system are shared", () => {
  assert.deepEqual(
    check("apps/api/src/members/lifecycle.ts", "../platform/config"),
    [],
  );
  assert.deepEqual(check("apps/web/src/members/x.tsx", "@/app/orpc"), []);
  assert.deepEqual(
    check("apps/web/src/members/x.tsx", "@/design-system/ui/button"),
    [],
  );
});

test("files outside a vertical (routes, entry) use indexes too", () => {
  assert.equal(
    check("apps/web/src/routes/auth/sign-up.tsx", "@/auth/use-auth").length,
    1,
  );
  assert.deepEqual(check("apps/web/src/routes/auth/sign-up.tsx", "@/auth"), []);
  assert.equal(check("apps/api/src/index.ts", "./auth/config").length, 1);
});

test("table files may import each other, and platform assembles them", () => {
  assert.deepEqual(
    check("apps/api/src/members/tables.ts", "../auth/tables"),
    [],
  );
  assert.deepEqual(
    check("apps/api/src/platform/database/schema.ts", "../../auth/tables"),
    [],
  );
  assert.equal(
    check("apps/api/src/members/procedures.ts", "../auth/tables").length,
    1,
  );
});

test("re-exports, dynamic imports and packages are handled", () => {
  assert.equal(
    check(
      "apps/api/src/members/index.ts",
      "../auth/config",
      "ExportNamedDeclaration",
    ).length,
    1,
  );
  assert.equal(
    check("apps/api/src/members/a.ts", "../auth/config", "ImportExpression")
      .length,
    1,
  );
  assert.deepEqual(check("apps/api/src/members/a.ts", "zod"), []);

  // `export const x = 1` has no source and is not an import.
  const reports = [];
  const handlers = rule.create({
    filename: join(root, "apps/api/src/members/a.ts"),
    report: (report) => reports.push(report),
  });
  handlers.ExportNamedDeclaration({ source: null });
  assert.deepEqual(reports, []);
});

test("tests are exempt", () => {
  assert.deepEqual(
    check("apps/api/src/members/a.test.ts", "../auth/config"),
    [],
  );
});

test("the API's #api/ alias is checked like a relative import", () => {
  assert.deepEqual(
    check("apps/api/src/members/a.ts", "#api/activity/index"),
    [],
  );
  assert.deepEqual(
    check("apps/api/src/members/a.ts", "#api/platform/config"),
    [],
  );
  assert.deepEqual(
    check("apps/api/src/members/a.ts", "#api/members/lib/x"),
    [],
  );
  const reports = check(
    "apps/api/src/members/a.ts",
    "#api/activity/recording/events",
  );
  assert.equal(reports.length, 1);
  assert.match(reports[0], /"activity" vertical/);
});
