import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SettingsShell } from "@/app/settings/settings-shell";

export const Route = createFileRoute("/_layout/_authenticated/$slug/settings")({
  component: SettingsLayout,
});

function SettingsLayout() {
  return (
    <SettingsShell>
      <Outlet />
    </SettingsShell>
  );
}
