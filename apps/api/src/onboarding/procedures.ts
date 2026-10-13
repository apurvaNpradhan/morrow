import { authed } from "#api/platform/orpc/base";
import { completeOnboarding } from "./operations/complete-onboarding";
import { onboardingCompletionSchema } from "./response";

export const complete = authed
  .output(onboardingCompletionSchema)
  .handler(({ context }) => completeOnboarding(context.userId));

export const onboardingRouter = { complete };
