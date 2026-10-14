import { createFileRoute } from "@tanstack/react-router";
import { ProjectWorkflowPage } from "@/projects";

export const Route = createFileRoute(
  "/_layout/_authenticated/$slug/settings/projects/$key/workflow",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { workspace } = Route.useRouteContext();
  const { key } = Route.useParams();
  return <ProjectWorkflowPage workspace={workspace} projectKey={key} />;
}
