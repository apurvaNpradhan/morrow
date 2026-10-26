import { z } from "zod";

export const txidResult = z.object({
  txid: z
    .number()
    .describe(
      "Postgres transaction id of the write, for waiting until sync delivers it.",
    ),
});

export const createdResult = txidResult.extend({ id: z.string() });
