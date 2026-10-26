import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");
const read = (path) => readFileSync(join(root, path), "utf8");

test("migrations are numbered in order and applied in timestamp order", () => {
  const { entries } = JSON.parse(read("apps/api/drizzle/meta/_journal.json"));
  entries.forEach((entry, position) => {
    assert.equal(
      entry.idx,
      position,
      `${entry.tag} sits at position ${position}`,
    );
    assert.ok(
      entry.tag.startsWith(String(position).padStart(4, "0")),
      entry.tag,
    );
    assert.ok(
      existsSync(join(root, "apps/api/drizzle", `${entry.tag}.sql`)),
      `${entry.tag}.sql exists`,
    );
    if (position === 0) return;
    // Drizzle skips a migration whose `when` is not newer than the last one applied.
    assert.ok(
      entry.when > entries[position - 1].when,
      `${entry.tag} is newer than ${entries[position - 1].tag}`,
    );
  });
});

test("every ADR has its own number", () => {
  const byNumber = new Map();
  for (const file of readdirSync(join(root, "docs/adr"))) {
    const number = /^(\d{4})-.+\.md$/.exec(file)?.[1];
    if (!number) continue;
    byNumber.set(number, [...(byNumber.get(number) ?? []), file]);
  }
  const clashes = [...byNumber].filter(([, files]) => files.length > 1);
  assert.deepEqual(clashes, []);
});

/** Directories under `dir` that hold a package.json, as pnpm-workspace.yaml globs them. */
function workspacePackages(dir) {
  const found = [];
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "node_modules") continue;
    const path = join(dir, entry.name);
    if (existsSync(join(root, path, "package.json"))) found.push(path);
    found.push(...workspacePackages(path));
  }
  return found;
}

test("the lockfile lists the workspace packages, no others", () => {
  const lock = read("pnpm-lock.yaml");
  const importers = lock
    .slice(lock.indexOf("\nimporters:"), lock.indexOf("\npackages:"))
    .split("\n")
    .flatMap((line) => /^ {2}(\S+):( \{\})?$/.exec(line)?.[1] ?? []);
  const packages = ["packages", "apps"].flatMap(workspacePackages);
  assert.deepEqual(
    importers.toSorted(),
    [".", ...packages.map((path) => relative(".", path))].toSorted(),
  );
});

test("the lockfile keeps the catalog the workspace declares", () => {
  const declared = /^catalog:/m.test(read("pnpm-workspace.yaml"));
  assert.equal(/^catalogs:/m.test(read("pnpm-lock.yaml")), declared);
});

test("the libraries that must be one copy are installed once", () => {
  // Two copies of ProseMirror's model or of Yjs break `instanceof` checks and
  // make documents unreadable across the editor, the schema package and the API.
  const lock = read("pnpm-lock.yaml");
  const packages = lock.slice(
    lock.indexOf("\npackages:\n"),
    lock.indexOf("\nsnapshots:\n"),
  );
  for (const name of [
    "prosemirror-model",
    "prosemirror-transform",
    "prosemirror-state",
    "yjs",
  ]) {
    const versions = [
      ...packages.matchAll(new RegExp(`^  '?${name}@([^:'()]+)'?:$`, "gm")),
    ].map((match) => match[1]);
    assert.ok(versions.length <= 1, `${name} is installed as ${versions}`);
  }
});

test("the image builds the document schema package", () => {
  const dockerfile = read("Dockerfile");
  for (const line of [
    "COPY packages/document-schema/package.json ./packages/document-schema/",
    "COPY packages/document-schema ./packages/document-schema",
    "WORKDIR /app/packages/document-schema",
    "COPY --from=api-builder /app/packages/document-schema ./packages/document-schema",
  ]) {
    assert.ok(dockerfile.includes(line), `Dockerfile has: ${line}`);
  }
});
