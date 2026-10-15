import { z } from "zod";

/** Allowlisted workspace activity events emitted after their source write commits. */
export const workspaceActivityEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("workspace.member_joined"),
    workspaceId: z.string(),
    memberId: z.string(),
    memberName: z.string(),
  }),
  z.object({
    type: z.literal("workspace.member_removed"),
    workspaceId: z.string(),
    memberId: z.string(),
    memberName: z.string(),
  }),
  z.object({
    type: z.literal("workspace.member_role_changed"),
    workspaceId: z.string(),
    memberId: z.string(),
    memberName: z.string(),
    previousRole: z.string(),
    role: z.string(),
  }),
  z.object({
    type: z.literal("workspace.invitation_created"),
    workspaceId: z.string(),
    invitationId: z.string(),
    role: z.string().nullable(),
  }),
  z.object({
    type: z.literal("workspace.invitation_revoked"),
    workspaceId: z.string(),
    invitationId: z.string(),
  }),
  z.object({
    type: z.literal("workspace.updated"),
    workspaceId: z.string(),
    fields: z.array(z.literal("details")).min(1),
  }),
  z.object({
    type: z.enum([
      "project.created",
      "project.archived",
      "project.unarchived",
      "project.deleted",
    ]),
    workspaceId: z.string(),
    projectId: z.string(),
    projectKey: z.string(),
    projectName: z.string(),
  }),
  z.object({
    type: z.literal("project.key_changed"),
    workspaceId: z.string(),
    projectId: z.string(),
    previousKey: z.string(),
    projectKey: z.string(),
  }),
  z.object({
    type: z.enum([
      "task.created",
      "task.completed",
      "task.canceled",
      "task.deleted",
    ]),
    workspaceId: z.string(),
    projectId: z.string(),
    taskId: z.string(),
    ticketId: z.string(),
    taskTitle: z.string(),
  }),
  z.object({
    type: z.literal("workspace.ownership_transferred"),
    workspaceId: z.string(),
    ownerId: z.string(),
    ownerName: z.string(),
  }),
]);

/** A safe event contract that never carries invitation addresses or secrets. */
export type WorkspaceActivityEvent = z.infer<
  typeof workspaceActivityEventSchema
>;

/** Parses an internal event before it becomes persisted activity. */
export function parseWorkspaceActivityEvent(
  input: unknown,
): WorkspaceActivityEvent {
  return workspaceActivityEventSchema.parse(input);
}
