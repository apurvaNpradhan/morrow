import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "#api/platform/database/index";
import { projectStoredWorkspaceActivity } from "#api/activity/index";
import { listProjects } from "#api/projects/index";

/**
 * Everything Morrow holds about one user, as a single JSON-ready document.
 * Webhook URLs and secrets are left out: they can carry credentials, and the
 * export file may be shared. Other members' personal data is not included.
 */
export async function exportAccountData(user: { id: string; email: string }) {
  const [profile] = await db
    .select({
      id: schema.userTable.id,
      name: schema.userTable.name,
      email: schema.userTable.email,
      image: schema.userTable.image,
      createdAt: schema.userTable.createdAt,
    })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, user.id))
    .limit(1);

  const memberships = await db
    .select({
      workspaceId: schema.workspaceTable.id,
      workspaceName: schema.workspaceTable.name,
      role: schema.workspaceUserTable.role,
      joinedAt: schema.workspaceUserTable.joinedAt,
    })
    .from(schema.workspaceUserTable)
    .innerJoin(
      schema.workspaceTable,
      eq(schema.workspaceUserTable.workspaceId, schema.workspaceTable.id),
    )
    .where(eq(schema.workspaceUserTable.userId, user.id));

  // The projects (and their columns) of the workspaces the user belongs to.
  const projects = (
    await Promise.all(
      memberships.map(async ({ workspaceId }) =>
        (await listProjects(workspaceId)).map((project) => ({
          workspaceId,
          id: project.id,
          key: project.key,
          name: project.name,
          description: project.description,
          icon: project.icon,
          archivedAt: project.archivedAt,
          columns: project.columns.map(({ name, category, color }) => ({
            name,
            category,
            color,
          })),
        })),
      ),
    )
  ).flat();

  const activityRows = await db
    .select({
      id: schema.activityTable.id,
      workspaceId: schema.activityTable.workspaceId,
      resourceType: schema.activityTable.resourceType,
      resourceId: schema.activityTable.resourceId,
      type: schema.activityTable.type,
      content: schema.activityTable.content,
      eventData: schema.activityTable.eventData,
      createdAt: schema.activityTable.createdAt,
    })
    .from(schema.activityTable)
    .where(eq(schema.activityTable.actorUserId, user.id))
    .orderBy(desc(schema.activityTable.createdAt));

  // The same projection the activity feed applies, so older rows don't leak
  // invitee details; names of other people are left out of the export.
  const activity = activityRows.map((row) => {
    const eventData = z
      .record(z.string(), z.unknown())
      .safeParse(row.eventData);
    const safe = projectStoredWorkspaceActivity({
      workspaceId: row.workspaceId,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      type: row.type,
      eventData: eventData.success ? eventData.data : {},
    });
    const aboutSomeoneElse =
      safe.resourceType === "user" && safe.resourceId !== user.id;
    const {
      memberName: _member,
      ownerName: _owner,
      ...withoutNames
    } = safe.eventData as Record<string, unknown>;
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      type: row.type,
      content: row.content,
      createdAt: row.createdAt,
      resourceType: safe.resourceType,
      resourceId: safe.resourceId,
      eventData: aboutSomeoneElse ? withoutNames : safe.eventData,
    };
  });

  return {
    exportedAt: new Date(),
    profile: profile ?? null,
    memberships,
    projects,
    activity,
  };
}
