import { z } from "zod";
import { COLUMN_CATEGORIES, COLUMN_COLORS } from "./projects.js";
import { TASK_PRIORITIES } from "./tasks.js";

export * from "./labels.js";
export * from "./projects.js";
export * from "./tasks.js";

/**
 * The columns each shape may send, in camelCase as the browser sees them. The
 * API takes the Electric column allowlist from these keys and the web app
 * validates its collections with them, so a column can only reach the browser
 * if it is listed here.
 */

/** A shape's name (what the browser asks for) with the columns it may send. */
function shape<Name extends string, Schema extends z.ZodObject>(
  name: Name,
  schema: Schema,
) {
  return { name, schema };
}

export const workspaceMembersShape = shape(
  "workspace-members",
  z.object({
    id: z.string(),
    workspaceId: z.string(),
    userId: z.string(),
    role: z.string(),
    joinedAt: z.date(),
  }),
);

export const workspaceMemberUsersShape = shape(
  "workspace-member-users",
  z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    image: z.string().nullable(),
  }),
);

export type WorkspaceMemberRow = z.infer<typeof workspaceMembersShape.schema>;
export type UserRow = z.infer<typeof workspaceMemberUsersShape.schema>;

export const workspacesShape = shape(
  "workspaces",
  z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    logo: z.string().nullable(),
    description: z.string().nullable(),
    createdAt: z.date(),
  }),
);

const invitationColumns = z.object({
  id: z.string(),
  workspaceId: z.string(),
  email: z.string(),
  role: z.string().nullable(),
  status: z.string(),
  expiresAt: z.date(),
  createdAt: z.date(),
  inviterId: z.string(),
});

/** Pending invitations of the Workspaces the user belongs to. */
export const workspaceInvitationsShape = shape(
  "workspace-invitations",
  invitationColumns,
);

/** Pending invitations addressed to the signed-in user's email. */
export const myInvitationsShape = shape("my-invitations", invitationColumns);

export type WorkspaceRow = z.infer<typeof workspacesShape.schema>;
export type InvitationRow = z.infer<typeof myInvitationsShape.schema>;

/** Every Project of the Workspaces the user belongs to, archived ones included. */
export const projectsShape = shape(
  "projects",
  z.object({
    id: z.string(),
    workspaceId: z.string(),
    key: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    icon: z.string().nullable(),
    color: z.enum(COLUMN_COLORS).nullable(),
    backgroundUrl: z.string().nullable(),
    archivedAt: z.date().nullable(),
    position: z.string(),
    createdAt: z.date(),
  }),
);

/** The Columns of those Projects. */
export const projectColumnsShape = shape(
  "project-columns",
  z.object({
    id: z.string(),
    projectId: z.string(),
    name: z.string(),
    category: z.enum(COLUMN_CATEGORIES),
    color: z.enum(COLUMN_COLORS),
    position: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
  }),
);

export type ProjectRow = z.infer<typeof projectsShape.schema>;
export type ProjectColumnRow = z.infer<typeof projectColumnsShape.schema>;

/**
 * Every Task of the Projects of the Workspaces the user belongs to, archived
 * ones included. `dueDate` is a `YYYY-MM-DD` string, never a Date.
 */
export const tasksShape = shape(
  "tasks",
  z.object({
    id: z.string(),
    projectId: z.string(),
    columnId: z.string(),
    number: z.number(),
    title: z.string(),
    checklistDone: z.number(),
    checklistTotal: z.number(),
    priority: z.enum(TASK_PRIORITIES),
    assigneeId: z.string().nullable(),
    dueDate: z.string().nullable(),
    labelIds: z.array(z.string()),
    position: z.string(),
    completedAt: z.date().nullable(),
    archivedAt: z.date().nullable(),
    createdBy: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  }),
);

export type TaskRow = z.infer<typeof tasksShape.schema>;

/**
 * A Task's markdown description, apart from the Task so that the list never
 * downloads text it does not show. Read on demand, one Task at a time, when
 * the Task is opened. Every Task has one.
 */
export const taskDescriptionsShape = shape(
  "task-descriptions",
  z.object({
    taskId: z.string(),
    projectId: z.string(),
    description: z.string(),
  }),
);

export type TaskDescriptionRow = z.infer<typeof taskDescriptionsShape.schema>;

/** The Labels of every Workspace the user belongs to. */
export const labelsShape = shape(
  "labels",
  z.object({
    id: z.string(),
    workspaceId: z.string(),
    name: z.string(),
    color: z.enum(COLUMN_COLORS),
    position: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
  }),
);

export type LabelRow = z.infer<typeof labelsShape.schema>;
