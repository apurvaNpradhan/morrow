import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

const webRoot = join(import.meta.dirname, "..");
let outDir = "";
let html = "";

/** Files the first render waits for: the entry script and its preloaded imports. */
function criticalScripts() {
  return [
    ...html.matchAll(
      /(?:modulepreload|module" crossorigin src)[^>]*"(\/assets\/[^"]+\.js)"/g,
    ),
  ].map((match) => match[1]);
}

beforeAll(() => {
  outDir = mkdtempSync(join(tmpdir(), "morrow-web-build-"));
  execFileSync("pnpm", ["exec", "vp", "build", "--outDir", outDir], {
    cwd: webRoot,
    stdio: "pipe",
  });
  html = readFileSync(join(outDir, "index.html"), "utf8");
}, 240_000);

afterAll(() => rmSync(outDir, { recursive: true, force: true }));

describe("production build", () => {
  it("keeps the editor and session replay out of the first render", () => {
    const critical = criticalScripts();
    expect(critical.length).toBeGreaterThan(0);

    for (const file of critical) {
      const code = readFileSync(join(outDir, file), "utf8");
      expect(code, file).not.toMatch(/prosemirror|@tiptap|lowlight/i);
      expect(file).not.toMatch(
        /description-markdown-editor|start-session-replay/,
      );
    }
  });

  it("splits libraries into stable vendor groups", () => {
    const assets = readdirSync(join(outDir, "assets"));
    for (const group of ["react", "base-ui", "sentry", "sync", "editor"]) {
      expect(
        assets.some((name) => name.startsWith(`vendor-${group}-`)),
        group,
      ).toBe(true);
    }
    expect(
      criticalScripts().some((file) => file.includes("vendor-editor")),
    ).toBe(false);
  });

  it("preloads the Latin body font that the stylesheet asks for", () => {
    const preload = html.match(
      /<link rel="preload" as="font" type="font\/woff2" href="([^"]+)" crossorigin/,
    );
    expect(preload).not.toBeNull();
    const href = preload![1];

    expect(href).toMatch(/inter-latin-wght-normal-.*\.woff2$/);
    expect(existsSync(join(outDir, href))).toBe(true);

    const stylesheet = html.match(/rel="stylesheet"[^>]*href="([^"]+)"/)![1];
    expect(readFileSync(join(outDir, stylesheet), "utf8")).toContain(href);
  });

  it("does not let the stylesheet block the first paint", () => {
    const tag = html.match(/<link rel="stylesheet"[^>]*>/)![0];

    expect(tag).toContain('media="print"');
    expect(tag).toContain("onload=");
    expect(html).toMatch(/<noscript><link rel="stylesheet"[^>]*><\/noscript>/);
  });

  it("paints the splash beside the app root", () => {
    expect(html).toMatch(
      /<div id="splash"[^>]*>[\s\S]*?<\/div>\s*<div id="root"><\/div>/,
    );
    expect(html).toContain('id="splash-script"');
  });
});
