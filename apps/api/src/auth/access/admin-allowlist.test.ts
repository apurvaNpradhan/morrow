import { describe, expect, it } from "vite-plus/test";
import { adminEmails, isAdminEmail } from "./admin-allowlist";

describe("adminEmails", () => {
  it("splits, trims and lowercases, ignoring blanks", () => {
    expect(adminEmails(" A@x.com, ,b@Y.com ")).toEqual(["a@x.com", "b@y.com"]);
    expect(adminEmails(undefined)).toEqual([]);
  });
});

describe("isAdminEmail", () => {
  const list = ["owner@example.com"];

  it("matches case-insensitively", () => {
    expect(isAdminEmail("Owner@Example.com", true, list)).toBe(true);
  });

  it("requires a verified email", () => {
    expect(isAdminEmail("owner@example.com", false, list)).toBe(false);
  });

  it("rejects addresses that are not listed", () => {
    expect(isAdminEmail("other@example.com", true, list)).toBe(false);
  });
});
