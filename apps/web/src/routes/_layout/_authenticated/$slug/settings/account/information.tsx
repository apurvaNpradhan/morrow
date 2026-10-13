import { createFileRoute } from "@tanstack/react-router";
import { ProfilePage } from "@/account";

export const Route = createFileRoute(
  "/_layout/_authenticated/$slug/settings/account/information",
)({
  component: ProfilePage,
});
