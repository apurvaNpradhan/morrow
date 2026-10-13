import { type } from "@orpc/server";
import { z } from "zod";
import { authApi, type AuthResult } from "#api/platform/orpc/auth-api";
import { admin } from "#api/platform/orpc/base";
import { addWorkspaceMember } from "./operations/add-workspace-member";
import { listUsers } from "./operations/list-users";
import { listWorkspaceMembers } from "./operations/list-workspace-members";
import { listWorkspaceRoles } from "./operations/list-workspace-roles";
import { listWorkspaces } from "./operations/list-workspaces";
import { removeWorkspaceMember } from "./operations/remove-workspace-member";
import { transferWorkspaceOwnership } from "./operations/transfer-workspace-ownership";
import { updateWorkspaceMemberRole } from "./operations/update-workspace-member-role";
import {
  adminUserListSchema,
  adminWorkspaceListSchema,
  adminWorkspaceMemberListSchema,
  adminWorkspaceRoleListSchema,
} from "./response";

const workspaceId = z.string().min(1);
const userId = z.string().min(1);
const assignableRole = z.string().min(1).max(100);
const paging = {
  search: z.string().max(200).optional(),
  page: z.number().int().min(1).max(1_000_000).default(1),
  limit: z.number().int().min(1).max(100).default(20),
};

const access = admin
  .output(z.object({ admin: z.literal(true) }))
  .handler(() => ({ admin: true as const }));

const users = {
  list: admin
    .input(z.object(paging))
    .output(adminUserListSchema)
    .handler(({ input }) => listUsers(input)),
  remove: admin
    .input(z.object({ userId }))
    .output(type<unknown>())
    .handler(async ({ context, input }) =>
      (await authApi()).removeUser({
        headers: context.authHeaders,
        body: { userId: input.userId },
      }),
    ),
  setDeactivated: admin
    .input(z.object({ userId, deactivate: z.boolean() }))
    .output(type<unknown>())
    .handler(async ({ context, input }) => {
      const api = await authApi();
      return input.deactivate
        ? api.banUser({
            headers: context.authHeaders,
            body: {
              userId: input.userId,
              banReason: "Deactivated by an instance administrator",
            },
          })
        : api.unbanUser({
            headers: context.authHeaders,
            body: { userId: input.userId },
          });
    }),
  update: admin
    .input(
      z.object({
        userId,
        name: z.string().min(1).max(200),
        email: z.string().email().max(320),
      }),
    )
    .output(type<AuthResult<"adminUpdateUser">>())
    .handler(async ({ context, input }) =>
      (await authApi()).adminUpdateUser({
        headers: context.authHeaders,
        body: {
          userId: input.userId,
          data: { name: input.name, email: input.email },
        },
      }),
    ),
};

const workspaces = {
  list: admin
    .input(z.object(paging))
    .output(adminWorkspaceListSchema)
    .handler(({ input }) => listWorkspaces(input)),
  members: admin
    .input(z.object({ workspaceId }))
    .output(adminWorkspaceMemberListSchema)
    .handler(({ input }) => listWorkspaceMembers(input.workspaceId)),
  roles: admin
    .input(z.object({ workspaceId }))
    .output(adminWorkspaceRoleListSchema)
    .handler(({ input }) => listWorkspaceRoles(input.workspaceId)),
  addMember: admin
    .input(z.object({ workspaceId, userId, role: assignableRole }))
    .output(adminWorkspaceMemberListSchema)
    .handler(({ input }) => addWorkspaceMember(input)),
  updateMemberRole: admin
    .input(z.object({ workspaceId, userId, role: assignableRole }))
    .output(adminWorkspaceMemberListSchema)
    .handler(({ input }) => updateWorkspaceMemberRole(input)),
  removeMember: admin
    .input(z.object({ workspaceId, userId }))
    .output(adminWorkspaceMemberListSchema)
    .handler(({ input }) => removeWorkspaceMember(input)),
  transferOwnership: admin
    .input(z.object({ workspaceId, userId }))
    .output(adminWorkspaceMemberListSchema)
    .handler(({ input }) => transferWorkspaceOwnership(input)),
};

export const adminRouter = { access, users, workspaces };
