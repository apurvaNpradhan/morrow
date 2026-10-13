import { checkWorkspaceName } from "./lib/check-workspace-name";
import { DEFAULT_ROLE_NAMES, defaultRolePayloads } from "@morrow/permissions";
import { APIError } from "better-auth/api";
import type { OrganizationOptions } from "better-auth/plugins/organization";
import { eq } from "drizzle-orm";
import { recordWorkspaceActivity } from "#api/activity/index";
import { config } from "#api/platform/config";
import { db, schema } from "#api/platform/database/index";
import { ownedImageKey, queueStorageCleanup } from "#api/storage/index";
import { getCreationState } from "./operations/get-creation-status";
import { decideWorkspaceCreation } from "./lib/creation-policy";
import {
  SLUG_UNAVAILABLE_MESSAGES,
  getSlugAvailability,
} from "./slug/availability";
import { logFailure } from "#api/platform/logger";

/** Write-path enforcement of the slug rules, so Better Auth calls can't bypass the availability procedure. */
async function assertSlugUsable(
  slug: string | undefined,
  workspaceId?: string,
) {
  if (slug === undefined) return;
  const availability = await getSlugAvailability(slug, workspaceId);
  if (!availability.available) {
    throw new APIError("BAD_REQUEST", {
      code: `SLUG_${availability.reason.toUpperCase()}`,
      message: SLUG_UNAVAILABLE_MESSAGES[availability.reason],
    });
  }
}

/** `logo` is written only by the logo procedures, which store and own the object. */
function assertNoClientLogo(logo: string | null | undefined) {
  if (logo === undefined) return;
  throw new APIError("BAD_REQUEST", {
    code: "USE_LOGO_ENDPOINT",
    message: "Change the workspace logo with the logo upload endpoint.",
  });
}

/** Workspace lifecycle: limits, name and slug rules, role seeding, activity. */
export const workspaceHooks = {
  beforeCreateOrganization: async ({ organization, user }) => {
    assertNoClientLogo(organization.logo);
    const decision = decideWorkspaceCreation(await getCreationState(user.id));
    if (!decision.allowed) {
      throw new APIError("FORBIDDEN", {
        code: "WORKSPACE_LIMIT_REACHED",
        message: `You can own at most ${config.maxWorkspacesPerUser} workspaces. Delete or transfer one to create another.`,
      });
    }
    const check = checkWorkspaceName(organization.name ?? "");
    if (!check.ok) {
      throw new APIError("BAD_REQUEST", { message: check.reason });
    }
    await assertSlugUsable(organization.slug);
  },
  beforeUpdateOrganization: async ({ organization, member }) => {
    assertNoClientLogo(organization.logo);
    if (organization.slug !== undefined) {
      // A rename must record the old slug as an alias, which only the
      // dedicated endpoint does. Reject here so it can't be bypassed.
      await assertSlugUsable(organization.slug, member.organizationId);
      const [current] = await db
        .select({ slug: schema.workspaceTable.slug })
        .from(schema.workspaceTable)
        .where(eq(schema.workspaceTable.id, member.organizationId))
        .limit(1);
      if (current?.slug !== organization.slug) {
        throw new APIError("BAD_REQUEST", {
          code: "USE_SLUG_ENDPOINT",
          message:
            "Change the workspace URL with PUT /api/workspace/{workspaceId}/slug.",
        });
      }
    }
    if (organization.name === undefined) return;
    const check = checkWorkspaceName(organization.name);
    if (!check.ok) {
      throw new APIError("BAD_REQUEST", { message: check.reason });
    }
  },
  afterCreateOrganization: async ({ organization }) => {
    // Seed the editable default roles for this workspace. Each
    // role's permissions are derived from the compiled-in defaults
    // in `@morrow/permissions`; admins can later replace them in the
    // Roles UI. We skip names that somehow already exist (this hook
    // is best-effort idempotent; the boot-time backfill is the
    // belt-and-braces path).
    try {
      const existing = await db
        .select({ role: schema.workspaceRoleTable.role })
        .from(schema.workspaceRoleTable)
        .where(eq(schema.workspaceRoleTable.workspaceId, organization.id));
      const taken = new Set(existing.map((r) => r.role));
      const now = new Date();
      const rows = DEFAULT_ROLE_NAMES.filter((name) => !taken.has(name)).map(
        (name) => ({
          workspaceId: organization.id,
          role: name,
          permission: JSON.stringify(defaultRolePayloads[name]),
          createdAt: now,
          updatedAt: now,
        }),
      );
      if (rows.length > 0) {
        await db
          .insert(schema.workspaceRoleTable)
          .values(rows)
          .onConflictDoNothing();
      }
    } catch (error) {
      logFailure(
        "workspace.seed-roles",
        { workspaceId: organization.id },
        error,
      );
    }
  },
  afterDeleteOrganization: async ({ organization }) => {
    const key = ownedImageKey(
      organization.logo,
      "workspace-logos",
      organization.id,
    );
    if (key) {
      await queueStorageCleanup(db, [key]).catch(() => {
        logFailure("workspace.queue-logo-cleanup");
      });
    }
  },
  afterUpdateOrganization: async ({ organization }) => {
    if (!organization) return;
    await recordWorkspaceActivity({
      type: "workspace.updated",
      workspaceId: organization.id,
      fields: ["details"],
    });
  },
} satisfies NonNullable<OrganizationOptions["organizationHooks"]>;
