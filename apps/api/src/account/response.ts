import { z } from "zod";

export const avatarSchema = z.object({
  url: z.string().describe("Public URL of the stored avatar."),
});

export const avatarDeletedSchema = z.object({
  deleted: z
    .boolean()
    .describe("False when the user had no uploaded avatar to remove."),
});

export const currentUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
  role: z.string().nullable(),
});
