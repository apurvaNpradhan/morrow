import { accountRouter } from "#api/account/index";
import { activityRouter } from "#api/activity/index";
import { adminRouter } from "#api/admin/index";
import { authRouter } from "#api/auth/index";
import { membersRouter } from "#api/members/index";
import { workspaceRouter } from "#api/workspace/index";
import { onboardingRouter } from "#api/onboarding/index";

/** The app router. A vertical adds its router here. */
export const appRouter = {
  account: accountRouter,
  admin: adminRouter,
  auth: authRouter,
  activity: activityRouter,
  members: membersRouter,
  onboarding: onboardingRouter,
  workspace: workspaceRouter,
};

export type AppRouter = typeof appRouter;
