import { type } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { CAPABILITIES } from "@morrow/permissions/capabilities";
import { recordWorkspaceActivity } from "#api/activity/index";
import { db } from "#api/platform/database/index";
import { workspaceUserTable } from "#api/platform/database/schema";
import { roleHasWorkspacePermission } from "#api/platform/permissions";
import { workspaceTable } from "./tables";
import { authApi, type AuthResult } from "#api/platform/orpc/auth-api";
import {
  authed,
  requireWorkspacePermission,
  userCan,
} from "#api/platform/orpc/base";
import { rateLimit } from "#api/platform/orpc/rate-limit";
import { getCreationStatus } from "./operations/get-creation-status";
import { getWorkspace } from "./operations/get-workspace";
import { saveWorkspaceLogo } from "./operations/save-workspace-logo";
import { setWorkspaceLogo } from "./operations/set-workspace-logo";
import { resolveWorkspace } from "./operations/resolve-workspace";
import {
  logoDeletedSchema,
  logoSchema,
  renamedSlugSchema,
  resolvedWorkspaceSchema,
  slugAvailabilitySchema,
  workspaceCreationStatusSchema,
  workspaceMetadataSchema,
} from "./response";
import { getSlugAvailability } from "./slug/availability";
import { renameWorkspaceSlug } from "./slug/rename-workspace-slug";

const workspaceId = z.string().min(1);

export const creationStatus = authed
  .output(workspaceCreationStatusSchema)
  .handler(({ context }) => getCreationStatus(context.userId));

export const slugAvailability = authed
  .use(rateLimit({ windowMs: 60_000, max: 120 }))
  .input(
    z.object({
      slug: z.string().min(1).max(100),
      workspaceId: z.string().optional(),
    }),
  )
  .output(slugAvailabilitySchema)
  .handler(async ({ context, input }) => {
    // Naming a workspace makes its own slugs "available": only those who may
    // rename it can ask, or the answer would reveal other workspaces' slugs.
    if (
      input.workspaceId &&
      !(await userCan(context.user, input.workspaceId, {
        workspace: ["update"],
      }))
    ) {
      throw new ORPCError("FORBIDDEN");
    }
    return getSlugAvailability(input.slug, input.workspaceId);
  });

export const resolve = authed
  .input(z.object({ slug: z.string() }))
  .output(resolvedWorkspaceSchema)
  .handler(async ({ context, input }) => ({
    ...(await resolveWorkspace(context.userId, input.slug)),
    requestedSlug: input.slug,
  }));

export const get = authed
  .input(z.object({ workspaceId }))
  .use(requireWorkspacePermission({ workspace: ["read"] }))
  .output(workspaceMetadataSchema)
  .handler(({ input }) => getWorkspace(input.workspaceId));

export const renameSlug = authed
  .input(z.object({ workspaceId, slug: z.string() }))
  .use(requireWorkspacePermission({ workspace: ["update"] }))
  .output(renamedSlugSchema)
  .handler(({ input }) => renameWorkspaceSlug(input.workspaceId, input.slug));

const publishLogoChange = (workspaceId: string) =>
  recordWorkspaceActivity({
    type: "workspace.updated",
    workspaceId,
    fields: ["details"],
  });

export const uploadLogo = authed
  .input(z.object({ workspaceId, file: z.instanceof(Blob) }))
  .use(requireWorkspacePermission({ workspace: ["update"] }))
  .output(logoSchema)
  .handler(async ({ input }) => {
    const saved = await saveWorkspaceLogo(input.workspaceId, input.file);
    await publishLogoChange(input.workspaceId);
    return saved;
  });

export const removeLogo = authed
  .input(z.object({ workspaceId }))
  .use(requireWorkspacePermission({ workspace: ["update"] }))
  .output(logoDeletedSchema)
  .handler(async ({ input }) => {
    const { hadLogo, txid } = await setWorkspaceLogo(input.workspaceId, null);
    await publishLogoChange(input.workspaceId);
    return { deleted: hadLogo, txid };
  });

export const list = authed
  .output(type<AuthResult<"listOrganizations">>())
  // Read from the database rather than Better Auth's endpoint, which needs a
  // session: MCP tools run as an OAuth token's user, with none.
  .handler(async ({ context }) => {
    const rows = await db
      .select({ workspace: workspaceTable, role: workspaceUserTable.role })
      .from(workspaceUserTable)
      .innerJoin(
        workspaceTable,
        eq(workspaceTable.id, workspaceUserTable.workspaceId),
      )
      .where(eq(workspaceUserTable.userId, context.userId));
    // A role without workspace:read must not learn the name or description.
    const readable = await Promise.all(
      rows.map((row) =>
        roleHasWorkspacePermission(row.workspace.id, row.role, {
          workspace: ["read"],
        }),
      ),
    );
    return rows
      .filter((_, index) => readable[index])
      .map((row) => row.workspace) as AuthResult<"listOrganizations">;
  });

export const create = authed
  .input(
    z.object({
      name: z.string().min(1).max(200),
      slug: z.string().min(1).max(100),
      description: z.string().max(2000).optional(),
    }),
  )
  .output(type<NonNullable<AuthResult<"createOrganization">>>())
  .handler(async ({ context, input }) => {
    const created = await (
      await authApi()
    ).createOrganization({ headers: context.authHeaders, body: input });
    return created as NonNullable<typeof created>;
  });

export const update = authed
  .input(
    z.object({
      workspaceId,
      name: z.string().min(1).max(200).optional(),
      description: z.string().max(2000).optional(),
      slug: z.string().optional(),
    }),
  )
  .output(type<NonNullable<AuthResult<"updateOrganization">>>())
  .handler(async ({ context, input }) => {
    const { workspaceId: organizationId, ...data } = input;
    const updated = await (
      await authApi()
    ).updateOrganization({
      headers: context.authHeaders,
      body: { organizationId, data },
    });
    return updated as NonNullable<typeof updated>;
  });

export const remove = authed
  .input(z.object({ workspaceId }))
  .output(type<unknown>())
  .handler(async ({ context, input }) =>
    (await authApi()).deleteOrganization({
      headers: context.authHeaders,
      body: { organizationId: input.workspaceId },
    }),
  );

export const setActive = authed
  .input(z.object({ workspaceId }))
  .output(type<unknown>())
  .handler(async ({ context, input }) =>
    (await authApi()).setActiveOrganization({
      headers: context.authHeaders,
      body: { organizationId: input.workspaceId },
    }),
  );

export const can = authed
  .input(
    z.object({
      workspaceId,
      permissions: z.record(z.string(), z.array(z.string())),
    }),
  )
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ context, input }) => ({
    success: await userCan(context.user, input.workspaceId, input.permissions),
  }));

export const capabilities = authed
  .input(z.object({ workspaceId }))
  .output(z.record(z.string(), z.boolean()))
  .handler(async ({ context, input }) => {
    const entries = await Promise.all(
      Object.entries(CAPABILITIES).map(
        async ([name, permissions]) =>
          [
            name,
            await userCan(
              context.user,
              input.workspaceId,
              Object.fromEntries(
                Object.entries(permissions).map(([resource, actions]) => [
                  resource,
                  [...actions],
                ]),
              ),
            ),
          ] as const,
      ),
    );
    return Object.fromEntries(entries);
  });

export const workspaceRouter = {
  list,
  create,
  update,
  remove,
  setActive,
  can,
  capabilities,
  get,
  resolve,
  renameSlug,
  uploadLogo,
  removeLogo,
  creationStatus,
  slugAvailability,
};
