import type { User as BetterAuthUser } from "better-auth/types";

export type User = BetterAuthUser & {
  locale?: string | null;
  onboardingCompletedAt?: Date | null;
  role?: string | null;
};
