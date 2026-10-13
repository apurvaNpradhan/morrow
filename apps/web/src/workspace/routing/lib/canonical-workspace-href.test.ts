import { describe, expect, it } from "vite-plus/test";
import { canonicalWorkspaceHref } from "./canonical-workspace-href";

describe("canonicalWorkspaceHref", () => {
  it("keeps the rest of the path, search and hash", () => {
    expect(
      canonicalWorkspaceHref(
        {
          pathname: "/old/settings/workspace/roles",
          search: "?a=1",
          hash: "#x",
        },
        "old",
        "new",
      ),
    ).toBe("/new/settings/workspace/roles?a=1#x");
  });

  it("rewrites the workspace root", () => {
    expect(canonicalWorkspaceHref({ pathname: "/old" }, "old", "new")).toBe(
      "/new",
    );
  });

  it("does nothing when the slug is already canonical", () => {
    expect(
      canonicalWorkspaceHref({ pathname: "/new/inbox" }, "new", "new"),
    ).toBeNull();
  });

  it("does not match a slug that merely starts with the requested one", () => {
    expect(
      canonicalWorkspaceHref({ pathname: "/older/inbox" }, "old", "new"),
    ).toBeNull();
  });
});
