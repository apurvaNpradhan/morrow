import { z } from "zod";
import { config } from "#api/platform/config";
import { base } from "#api/platform/orpc/base";

export const registrationStatus = base
  .output(z.object({ open: z.boolean() }))
  .handler(() => ({ open: config.registrationOpen }));

export const authRouter = { registrationStatus };
