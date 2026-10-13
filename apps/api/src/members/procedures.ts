import { type } from "@orpc/server";
import { z } from "zod";
import { authApi, type AuthResult } from "#api/platform/orpc/auth-api";
import { authed, requireWorkspacePermission } from "#api/platform/orpc/base";
import { invitationProcedures } from "./invitations/procedures";
import { listMembers } from "./operations/list-members";
import { workspaceMemberListSchema } from "./member-response";
import { roleProcedures } from "./roles/procedures";

const workspaceId = z.string().min(1);

export const list = authed
  .input(z.object({ workspaceId }))
  .use(requireWorkspacePermission({ workspace: ["read"] }))
  .output(workspaceMemberListSchema)
  .handler(({ context, input }) =>
    listMembers({ workspaceId: input.workspaceId, userId: context.userId }),
  );

export const page = authed
  .input(
    z.object({
      workspaceId,
      limit: z.number().int().min(1).max(500).optional(),
      offset: z.number().int().min(0).optional(),
      sortBy: z.string().max(64).optional(),
      sortDirection: z.enum(["asc", "desc"]).optional(),
      filterField: z.string().max(64).optional(),
      filterOperator: z
        .enum(["eq", "ne", "gt", "gte", "lt", "lte", "contains"])
        .optional(),
      filterValue: z.string().max(200).optional(),
    }),
  )
  .use(requireWorkspacePermission({ workspace: ["read"] }))
  .output(type<AuthResult<"listMembers">>())
  .handler(async ({ context, input }) => {
    const { workspaceId: organizationId, ...query } = input;
    return (await authApi()).listMembers({
      headers: context.authHeaders,
      query: { organizationId, ...query },
    });
  });

export const current = authed
  .input(z.object({ workspaceId }))
  .use(requireWorkspacePermission({ workspace: ["read"] }))
  .output(
    type<NonNullable<AuthResult<"listMembers">>["members"][number] | null>(),
  )
  .handler(async ({ context, input }) => {
    const result = await (
      await authApi()
    ).listMembers({
      headers: context.authHeaders,
      query: {
        organizationId: input.workspaceId,
        filterField: "userId",
        filterOperator: "eq",
        filterValue: context.userId,
        limit: 1,
      },
    });
    return result.members[0] ?? null;
  });

export const remove = authed
  .input(z.object({ workspaceId, memberIdOrEmail: z.string().min(1) }))
  .output(type<unknown>())
  .handler(async ({ context, input }) =>
    (await authApi()).removeMember({
      headers: context.authHeaders,
      body: {
        memberIdOrEmail: input.memberIdOrEmail,
        organizationId: input.workspaceId,
      },
    }),
  );

/** Leaving needs no member:delete permission, unlike removing someone else. */
export const leave = authed
  .input(z.object({ workspaceId }))
  .output(type<unknown>())
  .handler(async ({ context, input }) =>
    (await authApi()).leaveOrganization({
      headers: context.authHeaders,
      body: { organizationId: input.workspaceId },
    }),
  );

export const updateRole = authed
  .input(
    z.object({
      workspaceId,
      memberId: z.string().min(1),
      role: z.string().min(1).max(64),
    }),
  )
  .output(type<unknown>())
  .handler(async ({ context, input }) =>
    (await authApi()).updateMemberRole({
      headers: context.authHeaders,
      body: {
        memberId: input.memberId,
        organizationId: input.workspaceId,
        role: input.role,
      },
    }),
  );

// Better Auth has no transfer endpoint: promote the new owner first, then
// demote the old one. Demoting first would fail with no owner left; if the
// second step fails the workspace has two owners, which a retry repairs.
export const transferOwnership = authed
  .input(
    z.object({
      workspaceId,
      newOwnerMemberId: z.string().min(1),
      currentOwnerMemberId: z.string().min(1),
    }),
  )
  .output(type<unknown>())
  .handler(async ({ context, input }) => {
    const api = await authApi();
    await api.updateMemberRole({
      headers: context.authHeaders,
      body: {
        memberId: input.newOwnerMemberId,
        organizationId: input.workspaceId,
        role: "owner",
      },
    });
    return api.updateMemberRole({
      headers: context.authHeaders,
      body: {
        memberId: input.currentOwnerMemberId,
        organizationId: input.workspaceId,
        role: "admin",
      },
    });
  });

export const membersRouter = {
  list,
  page,
  current,
  remove,
  leave,
  updateRole,
  transferOwnership,
  ...invitationProcedures,
  roles: roleProcedures,
};
