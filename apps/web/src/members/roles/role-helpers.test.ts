import { expect, it } from "vite-plus/test";
import {
  isDefaultRole,
  permissionCount,
  permissionsEqual,
  sortRoles,
} from "./role-helpers";

const role = (name: string) =>
  ({
    id: name,
    workspaceId: "w",
    role: name,
    permission: {},
    createdAt: new Date(),
  }) as never;

it("compares permissions ignoring order", () => {
  expect(permissionsEqual({ a: ["x", "y"] }, { a: ["y", "x"] })).toBe(true);
  expect(permissionsEqual({ a: ["x"] }, { a: ["x"], b: ["z"] })).toBe(false);
});

it("counts every granted action", () => {
  expect(permissionCount({ a: ["x", "y"], b: ["z"], c: undefined })).toBe(3);
});

it("puts default roles first, in their canonical order", () => {
  const sorted = sortRoles([role("reviewer"), role("admin"), role("viewer")]);
  expect(sorted.map((r) => r.role)).toEqual(["viewer", "admin", "reviewer"]);
  expect(isDefaultRole("reviewer")).toBe(false);
});
