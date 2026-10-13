import { z } from "zod";

export const onboardingCompletionSchema = z.object({
  onboardingCompletedAt: z.date(),
});
