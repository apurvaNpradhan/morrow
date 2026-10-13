import { describe, expect, it, vi } from "vite-plus/test";

const { loadLocaleMock, defaultResources } = vi.hoisted(() => {
  const resources = {
    common: { testCommon: "common-value" },
    auth: { testAuth: "auth-value" },
  };
  return {
    loadLocaleMock: vi.fn(
      async (
        _locale: Parameters<(typeof import("@morrow/i18n"))["loadLocale"]>[0],
      ) => resources,
    ),
    defaultResources: resources,
  };
});

vi.mock("@morrow/i18n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@morrow/i18n")>();
  return {
    ...actual,
    loadLocale: loadLocaleMock,
  };
});

const { i18n, resolveLocale, preloadNamespaces } = await import("./index");

describe("resolveLocale", () => {
  it("normalizes en-US and falls back to English for removed locales", () => {
    expect(resolveLocale("en-us")).toBe("en-US");
    expect(resolveLocale("fr-FR")).toBe("en-US");
    expect(resolveLocale("ja", "de-DE")).toBe("en-US");
  });

  it("uses the browser locale when no preferred locale is set", () => {
    expect(resolveLocale(null, "EN-us")).toBe("en-US");
    expect(resolveLocale(null, "fr-FR")).toBe("en-US");
  });
});

describe("preloadNamespaces", () => {
  it("loads every namespace so non-default keys resolve after async init", async () => {
    loadLocaleMock.mockImplementation(async () => defaultResources);

    await preloadNamespaces("en-US");

    expect(i18n.t("auth:testAuth")).toBe("auth-value");
    expect(i18n.t("common:testCommon")).toBe("common-value");
  });

  it("reuses the cached locale JSON across calls", async () => {
    loadLocaleMock.mockImplementation(async () => defaultResources);

    const callsBefore = loadLocaleMock.mock.calls.length;

    await preloadNamespaces("en-US");

    expect(loadLocaleMock.mock.calls.length).toBe(callsBefore);
  });
});
