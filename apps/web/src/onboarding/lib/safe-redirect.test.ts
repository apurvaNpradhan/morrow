import { describe, expect, it } from "vite-plus/test";
import { getSafeRedirect } from "./safe-redirect";

describe("getSafeRedirect", () => {
  it("keeps same-origin paths with search and hash", () => {
    expect(getSafeRedirect("/acme/inbox?tab=1#x")).toBe("/acme/inbox?tab=1#x");
  });

  it.each([
    "//evil.example",
    "https://evil.example",
    "/\\evil",
    "",
    undefined,
    3,
  ])("drops %j", (value) => {
    expect(getSafeRedirect(value)).toBeUndefined();
  });
});
