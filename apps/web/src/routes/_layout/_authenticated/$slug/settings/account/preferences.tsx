import { createFileRoute } from "@tanstack/react-router";
import { PreferencesPage } from "@/app/settings/preferences/preferences-page";

export const Route = createFileRoute(
  "/_layout/_authenticated/$slug/settings/account/preferences",
)({
  component: PreferencesPage,
});
