import { describe, expect, it } from "vite-plus/test";
import { toNavigation } from "./destination";

describe("toNavigation", () => {
  it("splits path, search and hash", () => {
    expect(toNavigation("/acme/inbox?tab=1#top")).toEqual({
      to: "/acme/inbox",
      search: { tab: "1" },
      hash: "top",
    });
  });

  it("handles a bare path", () => {
    expect(toNavigation("/acme")).toEqual({
      to: "/acme",
      search: {},
      hash: undefined,
    });
  });
});
