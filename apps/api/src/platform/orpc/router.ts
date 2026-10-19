import { accountRouter } from "#api/account/index";
import { activityRouter } from "#api/activity/index";
import { adminRouter } from "#api/admin/index";
import { authRouter } from "#api/auth/index";
import { labelsRouter } from "#api/labels/index";
import { membersRouter } from "#api/members/index";
import { workspaceRouter } from "#api/workspace/index";
import { onboardingRouter } from "#api/onboarding/index";
import { projectsRouter } from "#api/projects/index";
import { searchRouter } from "#api/search/index";
import {
  commentsRouter,
  linksRouter,
  relationsRouter,
  tasksRouter,
} from "#api/tasks/index";

/** The app router. A vertical adds its router here. */
export const appRouter = {
  account: accountRouter,
  admin: adminRouter,
  auth: authRouter,
  comments: commentsRouter,
  links: linksRouter,
  activity: activityRouter,
  labels: labelsRouter,
  members: membersRouter,
  onboarding: onboardingRouter,
  projects: projectsRouter,
  relations: relationsRouter,
  search: searchRouter,
  tasks: tasksRouter,
  workspace: workspaceRouter,
};

export type AppRouter = typeof appRouter;
