import { createFileRoute } from "@tanstack/react-router";
import { ProjectsPage } from "@/projects";

export const Route = createFileRoute("/_layout/_authenticated/$slug/projects/")(
  { component: RouteComponent },
);

function RouteComponent() {
  const { workspace } = Route.useRouteContext();
  return <ProjectsPage workspace={workspace} />;
}
