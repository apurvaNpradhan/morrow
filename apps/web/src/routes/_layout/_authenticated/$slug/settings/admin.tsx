import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { adminAccessQueryOptions } from "@/admin";
import { loadSession } from "@/auth";

export const Route = createFileRoute(
  "/_layout/_authenticated/$slug/settings/admin",
)({
  beforeLoad: async ({ context, params }) => {
    let userId = context.session?.user.id;
    if (!userId && context.sessionError) {
      const { data } = await loadSession();
      userId = data?.user.id;
      if (!userId) {
        throw redirect({ to: "/auth/sign-in" });
      }
    }
    if (!userId) {
      throw redirect({
        to: "/$slug/settings/account/information",
        params: { slug: params.slug },
      });
    }

    const hasAccess = await context.queryClient.ensureQueryData(
      adminAccessQueryOptions(userId),
    );

    if (!hasAccess) {
      throw redirect({
        to: "/$slug/settings/account/information",
        params: { slug: params.slug },
      });
    }
  },
  component: Outlet,
});
