import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { resolveAssetBearerOrCookie } from "#api/auth/index";
import { hasWorkspacePermission } from "#api/platform/permissions";
import { validateWorkspaceAccess } from "#api/platform/validate-workspace-access";

type AssetAccessTarget = {
  workspaceId: string;
  surface: string;
  createdBy?: string | null;
};

export async function authorizeAssetAccess(
  c: Context,
  asset: AssetAccessTarget,
): Promise<void> {
  const { userId } = await resolveAssetBearerOrCookie(c);
  if (asset.surface.startsWith("draft") && asset.createdBy !== userId) {
    throw new HTTPException(403, {
      message: "Staged uploads are private to their owner",
    });
  }
  await validateWorkspaceAccess(userId, asset.workspaceId);

  // Membership alone is not enough: the member's role must grant workspace:read, as on the other workspace routes.
  c.set("userId", userId);
  c.set("workspaceId", asset.workspaceId);
  if (!(await hasWorkspacePermission(c, { workspace: ["read"] }))) {
    throw new HTTPException(403, { message: "Insufficient permissions" });
  }
}
