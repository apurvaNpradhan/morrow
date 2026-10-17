import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { RESERVED_WORKSPACE_SLUGS } from "@morrow/permissions/workspace-slug";
import { describe, expect, it } from "vite-plus/test";

const API_AND_STATIC_PATHS = ["api", "rpc", "mcp", "assets", "images"];

function topLevelSegments(): string[] {
  const tree = readFileSync(resolve(__dirname, "../routeTree.gen.ts"), "utf8");
  const block = tree.match(
    /interface FileRoutesByFullPath \{([\s\S]*?)\n\}/,
  )?.[1];
  if (!block) throw new Error("FileRoutesByFullPath not found");
  const segments = new Set<string>();
  for (const [, path] of block.matchAll(/^\s*'([^']+)':/gm)) {
    const segment = path.split("/")[1];
    if (segment && segment !== "$slug") segments.add(segment);
  }
  return [...segments];
}

describe("reserved workspace slugs", () => {
  it("covers every top-level route segment", () => {
    const missing = [...topLevelSegments(), ...API_AND_STATIC_PATHS].filter(
      (segment) => !RESERVED_WORKSPACE_SLUGS.includes(segment),
    );
    expect(missing).toEqual([]);
  });
});
