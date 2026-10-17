import { z } from "zod";

export const txidResult = z.object({
  txid: z
    .number()
    .describe(
      "Postgres transaction id of the write, for waiting until sync delivers it.",
    ),
});

export const createdResult = txidResult.extend({ id: z.string() });

export const labelListResult = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    color: z.string(),
    position: z.string(),
  }),
);

export const usageResult = z.array(
  z.object({
    labelId: z.string(),
    count: z.number().describe("How many tasks carry the label."),
  }),
);
