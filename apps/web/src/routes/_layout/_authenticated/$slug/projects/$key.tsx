import { createFileRoute } from "@tanstack/react-router";
import { ProjectBoardPage } from "@/projects";

export const Route = createFileRoute(
  "/_layout/_authenticated/$slug/projects/$key",
)({ component: RouteComponent });

function RouteComponent() {
  const { workspace } = Route.useRouteContext();
  const { key } = Route.useParams();
  return <ProjectBoardPage workspace={workspace} projectKey={key} />;
}
