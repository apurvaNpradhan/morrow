// Local oxlint plugin: `morrow/vertical-boundaries`.
//
// Code lives in verticals (folders named by what they do) mirrored across the
// API and the web app. Another vertical may be reached only through its
// `index.ts`; `platform` (API), `app` and `design-system` (web) may be imported
// from anywhere. Tests are exempt, and `schema.ts` files may import each other
// because tables reference each other through foreign keys.
import { dirname, join, relative, resolve, sep } from "node:path";

const SHARED = new Set(["platform", "app", "design-system"]);
const VERTICALS = {
  "apps/api/src": new Set([
    "auth",
    "account",
    "workspace",
    "members",
    "projects",
    "tasks",
    "labels",
    "documents",
    "activity",
    "onboarding",
    "admin",
    "mcp",
    "storage",
    "platform",
  ]),
  "apps/web/src": new Set([
    "auth",
    "account",
    "workspace",
    "members",
    "projects",
    "tasks",
    "labels",
    "documents",
    "activity",
    "onboarding",
    "admin",
    "mcp",
    "storage",
    "app",
    "design-system",
  ]),
};

const root = resolve(import.meta.dirname, "../..");

/** { base, vertical, rest } for a path inside a known source tree, else null. */
function locate(absolute) {
  const rel = relative(root, absolute).split(sep).join("/");
  for (const [base, names] of Object.entries(VERTICALS)) {
    if (rel === base || !rel.startsWith(`${base}/`)) continue;
    const inside = rel.slice(base.length + 1);
    const [first, ...tail] = inside.split("/");
    return {
      base,
      vertical: names.has(first) ? first : null,
      rest: names.has(first) ? tail.join("/") : inside,
    };
  }
  return null;
}

function resolveSpecifier(specifier, filename) {
  if (specifier.startsWith("#api/"))
    // Package `imports` alias of the API: `#api/x` is `apps/api/src/x`.
    return join(root, "apps/api/src", specifier.slice(5));
  if (specifier.startsWith(".")) return resolve(dirname(filename), specifier);
  if (specifier.startsWith("@/")) {
    // `@/` is the `src` folder of the app the importing file belongs to.
    const base = Object.keys(VERTICALS).find((name) =>
      filename.startsWith(join(root, name) + sep),
    );
    return base ? join(root, base, specifier.slice(2)) : null;
  }
  return null;
}

const isIndex = (rest) => /^index(\.[cm]?[jt]sx?)?$/.test(rest) || rest === "";
const isSchema = (rest) => /^(schema|tables)(\.[cm]?[jt]sx?)?$/.test(rest);

const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Import another vertical only through its index.ts (platform, app and design-system are shared).",
    },
  },
  create(context) {
    const filename = context.filename ?? context.getFilename();
    if (/\.test\.[cm]?[jt]sx?$/.test(filename)) return {};
    const here = locate(filename);
    if (!here) return {};

    function check(node, specifier) {
      if (typeof specifier !== "string") return;
      const absolute = resolveSpecifier(specifier, filename);
      if (!absolute) return;
      const target = locate(absolute);
      if (!target || target.base !== here.base || !target.vertical) return;
      if (target.vertical === here.vertical) return;
      if (SHARED.has(target.vertical)) return;
      if (isIndex(target.rest)) return;
      if (
        isSchema(target.rest) &&
        (here.vertical === "platform" || isSchema(here.rest))
      )
        return;
      context.report({
        node,
        message: `Import "${specifier}" reaches into the "${target.vertical}" vertical; import its index instead.`,
      });
    }

    return {
      ImportDeclaration: (node) => check(node, node.source.value),
      ExportNamedDeclaration: (node) =>
        node.source && check(node, node.source.value),
      ExportAllDeclaration: (node) => check(node, node.source.value),
      ImportExpression: (node) =>
        node.source.type === "Literal" && check(node, node.source.value),
    };
  },
};

export default {
  meta: { name: "morrow" },
  rules: { "vertical-boundaries": rule },
};
