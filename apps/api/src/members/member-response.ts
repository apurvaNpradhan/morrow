import { z } from "zod";

export const workspaceMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
  role: z
    .string()
    .describe(
      "The member's workspace role: a built-in role (owner, admin, member, guest) or a custom role name.",
    ),
});

export const workspaceMemberListSchema = z.array(workspaceMemberSchema);
