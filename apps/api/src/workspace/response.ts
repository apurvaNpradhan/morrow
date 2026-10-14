import { z } from "zod";

export const workspaceMetadataSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  logo: z.string().nullable(),
  description: z.string().nullable(),
  createdAt: z.date(),
});

const txid = z
  .number()
  .nullable()
  .describe(
    "Postgres transaction id of the write, for waiting until sync delivers it; null when nothing changed.",
  );

export const logoSchema = z.object({
  url: z.string().describe("Public URL of the stored logo."),
  txid,
});

export const logoDeletedSchema = z.object({
  deleted: z
    .boolean()
    .describe("False when the workspace had no uploaded logo to remove."),
  txid,
});

export const workspaceCreationStatusSchema = z.object({
  canCreate: z.boolean(),
  reason: z
    .enum(["limit"])
    .nullable()
    .describe("Why creation is unavailable: the per-user limit was reached."),
  limit: z
    .number()
    .int()
    .nullable()
    .describe(
      "Workspaces the user may own (MAX_WORKSPACES_PER_USER); null for instance admins, who are exempt.",
    ),
  owned: z.number().int().describe("Workspaces the user currently owns."),
});

export const slugAvailabilitySchema = z.discriminatedUnion("available", [
  z.object({ available: z.literal(true) }),
  z.object({
    available: z.literal(false),
    reason: z.enum(["taken", "reserved", "invalid"]),
  }),
]);

export const resolvedWorkspaceSchema = workspaceMetadataSchema.extend({
  requestedSlug: z
    .string()
    .describe(
      "The slug that was looked up. It differs from `slug` when it is a former slug that should redirect.",
    ),
});

export const renamedSlugSchema = z.object({ slug: z.string(), txid });
