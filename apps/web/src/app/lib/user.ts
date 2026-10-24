import type { User as BetterAuthUser } from "better-auth/types";

export type User = BetterAuthUser & {
  locale?: string | null;
  /** An IANA name; null or absent follows the browser. */
  timeZone?: string | null;
  onboardingCompletedAt?: Date | null;
  role?: string | null;
};
