import { createFileRoute } from "@tanstack/react-router";
import { ProjectsSettingsIndex } from "@/projects";

export const Route = createFileRoute(
  "/_layout/_authenticated/$slug/settings/projects/",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { workspace } = Route.useRouteContext();
  return <ProjectsSettingsIndex workspace={workspace} />;
}
