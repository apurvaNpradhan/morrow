import { createFileRoute } from "@tanstack/react-router";
import { LabelsSettingsPage } from "@/labels";

export const Route = createFileRoute(
  "/_layout/_authenticated/$slug/settings/workspace/labels",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { workspace } = Route.useRouteContext();
  return <LabelsSettingsPage workspace={workspace} />;
}
