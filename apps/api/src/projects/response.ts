import { colorHex, COLUMN_CATEGORIES } from "@morrow/sync-schemas";
import { z } from "zod";

export const txid = z
  .number()
  .describe(
    "Postgres transaction id of the write, for waiting until sync delivers it.",
  );

export const nullableTxid = txid
  .nullable()
  .describe(
    "Null when the call changed nothing, so there is nothing to wait for.",
  );

export const txidResult = z.object({ txid });

export const createdResult = z.object({
  id: z.string(),
  txid,
});

const columnSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  category: z.enum(COLUMN_CATEGORIES),
  color: colorHex,
  position: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const projectWithColumnsSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  key: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  color: colorHex.nullable(),
  backgroundUrl: z.string().nullable(),
  archivedAt: z.date().nullable(),
  lastTaskNumber: z.number(),
  position: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  columns: z
    .array(columnSchema)
    .describe("In board order: by category, then by position."),
});

export const backgroundResult = z.object({
  url: z.string().describe("Public URL of the stored background."),
  txid,
});

export const backgroundRemovedResult = z.object({
  deleted: z
    .boolean()
    .describe("False when the project had no uploaded background to remove."),
  txid,
});

export const fieldUsageResult = z.array(
  z.object({
    fieldId: z.string(),
    optionId: z.string(),
    count: z.number().describe("Tasks holding this option of this Field."),
  }),
);
