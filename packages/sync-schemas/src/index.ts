import { z } from "zod";

/**
 * The columns each shape may send, in camelCase as the browser sees them. The
 * API takes the Electric column allowlist from these keys and the web app
 * validates its collections with them, so a column can only reach the browser
 * if it is listed here.
 */

export const workspaceMemberShapeSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  userId: z.string(),
  role: z.string(),
  joinedAt: z.date(),
});

export const userShapeSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
});

export type WorkspaceMemberRow = z.infer<typeof workspaceMemberShapeSchema>;
export type UserRow = z.infer<typeof userShapeSchema>;
