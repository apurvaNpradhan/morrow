import { z } from "zod";

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
