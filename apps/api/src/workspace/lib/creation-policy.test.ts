import { describe, expect, it } from "vite-plus/test";
import { decideWorkspaceCreation } from "./creation-policy";

const base = { limit: 3, isInstanceAdmin: false, owned: 0 };

describe("decideWorkspaceCreation", () => {
  it("allows a user under the limit", () => {
    expect(decideWorkspaceCreation({ ...base, owned: 2 }).allowed).toBe(true);
  });

  it("blocks a user at the limit", () => {
    expect(decideWorkspaceCreation({ ...base, owned: 3 })).toEqual({
      allowed: false,
      reason: "limit",
    });
  });

  it("honours a custom limit", () => {
    expect(
      decideWorkspaceCreation({ ...base, limit: 1, owned: 1 }).reason,
    ).toBe("limit");
    expect(
      decideWorkspaceCreation({ ...base, limit: 5, owned: 4 }).allowed,
    ).toBe(true);
  });

  it("exempts instance admins from the limit", () => {
    expect(
      decideWorkspaceCreation({ ...base, isInstanceAdmin: true, owned: 9 })
        .allowed,
    ).toBe(true);
  });
});
