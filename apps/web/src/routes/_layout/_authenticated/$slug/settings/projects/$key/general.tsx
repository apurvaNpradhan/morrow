import { createFileRoute } from "@tanstack/react-router";
import { ProjectGeneralPage } from "@/projects";

export const Route = createFileRoute(
  "/_layout/_authenticated/$slug/settings/projects/$key/general",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { workspace } = Route.useRouteContext();
  const { key } = Route.useParams();
  return <ProjectGeneralPage workspace={workspace} projectKey={key} />;
}
