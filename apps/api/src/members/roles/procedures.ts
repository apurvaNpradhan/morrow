import { type } from "@orpc/server";
import { z } from "zod";
import { authApi, type AuthResult } from "#api/platform/orpc/auth-api";
import { authed, requireWorkspacePermission } from "#api/platform/orpc/base";

const workspaceId = z.string().min(1);
const permission = z.record(z.string(), z.array(z.string()));

/** Being a member means being able to read the workspace, so no role may omit it. */
function withReadAccess(granted: Record<string, string[]>) {
  const workspace = granted.workspace ?? [];
  return {
    ...granted,
    workspace: workspace.includes("read") ? workspace : [...workspace, "read"],
  };
}

export const roleProcedures = {
  list: authed
    .input(z.object({ workspaceId }))
    .use(requireWorkspacePermission({ workspace: ["read"] }))
    .output(type<AuthResult<"listOrgRoles">>())
    .handler(async ({ context, input }) =>
      (await authApi()).listOrgRoles({
        headers: context.authHeaders,
        query: { organizationId: input.workspaceId },
      }),
    ),
  create: authed
    .input(
      z.object({ workspaceId, role: z.string().min(1).max(64), permission }),
    )
    .output(type<unknown>())
    .handler(async ({ context, input }) =>
      (await authApi()).createOrgRole({
        headers: context.authHeaders,
        body: {
          organizationId: input.workspaceId,
          role: input.role,
          permission: withReadAccess(input.permission),
        },
      }),
    ),
  update: authed
    .input(z.object({ workspaceId, roleName: z.string().min(1), permission }))
    .output(type<unknown>())
    .handler(async ({ context, input }) =>
      (await authApi()).updateOrgRole({
        headers: context.authHeaders,
        body: {
          organizationId: input.workspaceId,
          roleName: input.roleName,
          data: { permission: withReadAccess(input.permission) },
        },
      }),
    ),
  remove: authed
    .input(z.object({ workspaceId, roleName: z.string().min(1) }))
    .output(type<unknown>())
    .handler(async ({ context, input }) =>
      (await authApi()).deleteOrgRole({
        headers: context.authHeaders,
        body: {
          organizationId: input.workspaceId,
          roleName: input.roleName,
        },
      }),
    ),
};
