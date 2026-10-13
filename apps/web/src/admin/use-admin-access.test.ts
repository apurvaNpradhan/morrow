import { ORPCError } from "@orpc/client";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { adminAccessQueryOptions } from "./use-admin-access";

// A plain function, not vi.fn(): vitest's result tracking leaves a rejected
// promise unhandled and fails the run.
const server = vi.hoisted(() => ({
  access: async (): Promise<unknown> => ({ admin: true }),
}));

vi.mock("@/app/lib/orpc", () => ({
  rpc: { admin: { access: () => server.access() } },
}));
vi.mock("@/auth/use-auth", () => ({
  useAuth: () => ({ user: null }),
}));

const run = () =>
  (
    adminAccessQueryOptions("ada").queryFn as unknown as () => Promise<boolean>
  )();

describe("admin access", () => {
  beforeEach(() => {
    server.access = async () => ({ admin: true });
  });

  it("is true for an administrator", async () => {
    await expect(run()).resolves.toBe(true);
  });

  it.each(["FORBIDDEN", "UNAUTHORIZED"])("is false on %s", async (code) => {
    server.access = async () => {
      throw new ORPCError(code);
    };
    await expect(run()).resolves.toBe(false);
  });

  it("rethrows other failures so a blip is not treated as denial", async () => {
    server.access = async () => {
      throw new ORPCError("BAD_GATEWAY");
    };
    await expect(run()).rejects.toThrow();
  });
});
