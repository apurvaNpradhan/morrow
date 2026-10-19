import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { removeSplashOnFirstResolve } from "./remove-splash";

const webRoot = join(import.meta.dirname, "../../..");
const indexHtml = readFileSync(join(webRoot, "index.html"), "utf8");
const indexCss = readFileSync(join(webRoot, "src/index.css"), "utf8");

/** The value of `--name` in the `selector { ... }` block of index.css. */
function token(selector: string, name: string) {
  const block = indexCss.match(
    new RegExp(`^${selector} \\{([\\s\\S]*?)^\\}`, "m"),
  );
  const value = block?.[1].match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1];
  if (!value) throw new Error(`no ${name} in ${selector}`);
  return value.trim().toLowerCase();
}

/** The splash's own CSS: the rules from `#splash` on, whitespace squeezed. */
const splashCss = indexHtml
  .match(/<style>([\s\S]*?)<\/style>/)![1]
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\s+/g, " ");

describe("splash colours", () => {
  it.each([
    ["light", ":root"],
    ["dark", "\\.dark"],
  ])("match the %s theme tokens", (theme, selector) => {
    const background = token(selector, "background");
    const foreground = token(selector, "foreground");
    const border = token(selector, "border");
    const muted = token(selector, "sidebar-foreground");
    // The splash paints one colour behind the sidebar and the page.
    expect(token(selector, "sidebar")).toBe(background);

    if (theme === "light") {
      expect(splashCss).toContain(
        `background: ${background}; color: ${foreground};`,
      );
      expect(splashCss).toContain(`border: 1px solid ${border};`);
      expect(splashCss).toContain(`margin: 0; color: ${muted};`);
    } else {
      expect(splashCss).toContain(
        `#splash[data-theme="dark"] { background: ${background}; color: ${foreground}; }`,
      );
      expect(splashCss).toContain(
        `#splash[data-theme="dark"] i { border-color: ${border}; }`,
      );
      expect(splashCss).toContain(
        `#splash[data-theme="dark"] p { color: ${muted}; }`,
      );
    }
  });
});

describe("splash markup", () => {
  it("is a sibling of the app root, not inside it", () => {
    const doc = new DOMParser().parseFromString(indexHtml, "text/html");
    const splash = doc.getElementById("splash")!;
    const root = doc.getElementById("root")!;

    expect(splash.parentElement).toBe(doc.body);
    expect(root.parentElement).toBe(doc.body);
    expect(root.contains(splash)).toBe(false);
  });
});

describe("splash script", () => {
  const script = indexHtml.match(
    /<script id="splash-script">([\s\S]*?)<\/script>/,
  )![1];

  function run({
    path = "/atlas/projects/MOR/board",
    preferences,
    stamp,
  }: {
    path?: string;
    preferences?: unknown;
    stamp?: boolean;
  }) {
    document.body.innerHTML =
      '<div id="splash" data-theme="dark"><i></i></div>';
    history.pushState({}, "", path);
    localStorage.clear();
    if (preferences !== undefined) {
      localStorage.setItem(
        "device-preferences",
        JSON.stringify({ "s:device": { versionKey: "v", data: preferences } }),
      );
    }
    if (stamp) {
      localStorage.setItem(
        "morrow:owner-stamp",
        JSON.stringify({ userId: "u1", user: { id: "u1" } }),
      );
    }
    new Function(script)();
    return document.getElementById("splash")!;
  }

  afterEach(() => {
    localStorage.clear();
    document.body.innerHTML = "";
  });

  it("paints dark by default, with no stored preferences", () => {
    expect(run({}).getAttribute("data-theme")).toBe("dark");
  });

  it("follows a stored light theme", () => {
    expect(
      run({ preferences: { theme: "light" } }).getAttribute("data-theme"),
    ).toBe("light");
  });

  it("falls back to dark when storage holds something unreadable", () => {
    document.body.innerHTML =
      '<div id="splash" data-theme="dark"><i></i></div>';
    localStorage.setItem("device-preferences", "{not json");
    new Function(script)();

    expect(document.getElementById("splash")!.getAttribute("data-theme")).toBe(
      "dark",
    );
  });

  it("shows the sidebar outline for a known user on an app page", () => {
    expect(run({ stamp: true }).hasAttribute("data-sidebar")).toBe(true);
  });

  it.each([
    ["without a known user", { stamp: false }],
    [
      "when the sidebar defaults to closed",
      { stamp: true, preferences: { sidebarDefaultOpen: false } },
    ],
    ["on a sign-in page", { stamp: true, path: "/auth/sign-in" }],
    ["on an invitation page", { stamp: true, path: "/invitation/accept/abc" }],
    ["during onboarding", { stamp: true, path: "/onboarding/workspace" }],
  ])("hides the sidebar outline %s", (_name, options) => {
    expect(run(options).hasAttribute("data-sidebar")).toBe(false);
  });

  it("leaves the narrow-screen rule to the stylesheet", () => {
    expect(splashCss).toContain(
      "@media (min-width: 768px) { #splash[data-sidebar] { padding-inline-start: 15rem; } #splash[data-sidebar] i { display: block; } }",
    );
  });
});

describe("removing the splash", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="splash"></div><div id="root"></div>';
  });

  it("happens when the router resolves its first location, not before", async () => {
    const router = createRouter({
      routeTree: createRootRoute(),
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    removeSplashOnFirstResolve(router);

    expect(document.getElementById("splash")).not.toBeNull();
    await router.load();

    await new Promise((resolve) => setTimeout(resolve));
    expect(document.getElementById("splash")).toBeNull();
    expect(document.getElementById("root")).not.toBeNull();
  });
});
