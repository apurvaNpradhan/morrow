import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { state } = vi.hoisted(() => ({
  state: {
    validateCalls: [] as { userId: string; workspaceId: string }[],
    canRead: true,
    caller: "anonymous" as "anonymous" | "member" | "outsider" | "admin",
  },
}));

vi.mock("#api/auth/index", () => ({
  resolveAssetBearerOrCookie: async () => {
    if (state.caller === "anonymous") {
      throw new HTTPException(401, { message: "Unauthorized" });
    }
    return { userId: `user-${state.caller}` };
  },
}));

vi.mock("#api/platform/validate-workspace-access", () => ({
  validateWorkspaceAccess: async (userId: string, workspaceId: string) => {
    state.validateCalls.push({ userId, workspaceId });
    if (userId !== "user-member" && userId !== "user-admin") {
      throw new HTTPException(403, {
        message: "You don't have access to this workspace",
      });
    }
  },
}));

vi.mock("#api/platform/permissions", () => ({
  hasWorkspacePermission: async () => state.canRead,
}));

const { authorizeAssetAccess } = await import("./authorize-asset-access");
const context = { set: () => {} } as unknown as Context;

async function statusOf(promise: Promise<void>) {
  try {
    await promise;
    return 200;
  } catch (error) {
    return error instanceof HTTPException ? error.status : 500;
  }
}

describe("authorizeAssetAccess", () => {
  beforeEach(() => {
    state.validateCalls = [];
    state.caller = "anonymous";
    state.canRead = true;
  });

  it("rejects a member whose role lacks workspace:read", async () => {
    state.caller = "member";
    state.canRead = false;
    expect(
      await statusOf(
        authorizeAssetAccess(context, {
          workspaceId: "workspace-1",
          attachedAt: new Date(),
        }),
      ),
    ).toBe(403);
  });

  it("rejects an anonymous caller for a private asset", async () => {
    expect(
      await statusOf(
        authorizeAssetAccess(context, {
          workspaceId: "workspace-1",
          attachedAt: new Date(),
        }),
      ),
    ).toBe(401);
    expect(state.validateCalls).toHaveLength(0);
  });

  it("allows a workspace member to read a private asset", async () => {
    state.caller = "member";
    expect(
      await statusOf(
        authorizeAssetAccess(context, {
          workspaceId: "workspace-1",
          attachedAt: new Date(),
        }),
      ),
    ).toBe(200);
    expect(state.validateCalls).toEqual([
      { userId: "user-member", workspaceId: "workspace-1" },
    ]);
  });

  it("allows a workspace administrator through the same workspace check", async () => {
    state.caller = "admin";
    expect(
      await statusOf(
        authorizeAssetAccess(context, {
          workspaceId: "workspace-1",
          attachedAt: new Date(),
        }),
      ),
    ).toBe(200);
    expect(state.validateCalls).toEqual([
      { userId: "user-admin", workspaceId: "workspace-1" },
    ]);
  });

  it("rejects an authenticated non-member for a private asset", async () => {
    state.caller = "outsider";
    expect(
      await statusOf(
        authorizeAssetAccess(context, {
          workspaceId: "workspace-1",
          attachedAt: new Date(),
        }),
      ),
    ).toBe(403);
  });

  it("keeps draft uploads private to their uploader", async () => {
    state.caller = "member";
    const draft = {
      workspaceId: "workspace-1",
      attachedAt: null,
      createdBy: "user-other-member",
    };
    expect(await statusOf(authorizeAssetAccess(context, draft))).toBe(403);
    expect(state.validateCalls).toHaveLength(0);

    expect(
      await statusOf(
        authorizeAssetAccess(context, { ...draft, createdBy: "user-member" }),
      ),
    ).toBe(200);
  });
});
