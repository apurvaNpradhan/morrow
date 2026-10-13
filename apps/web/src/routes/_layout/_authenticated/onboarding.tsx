import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { z } from "zod/v4";
import { toNavigation } from "@/onboarding";
import { getSafeRedirect } from "@/onboarding";

export const Route = createFileRoute("/_layout/_authenticated/onboarding")({
  validateSearch: z.object({
    redirect: z
      .string()
      .optional()
      .transform((value) => getSafeRedirect(value)),
  }),
  beforeLoad: ({ context, search }) => {
    // Someone who has finished has no business in the flow.
    if (context.session?.user.onboardingCompletedAt) {
      throw redirect({
        ...toNavigation(search.redirect ?? "/"),
        replace: true,
      } as never);
    }
  },
  component: Outlet,
});
