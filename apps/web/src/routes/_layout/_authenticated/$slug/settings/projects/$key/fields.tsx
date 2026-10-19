import { createFileRoute } from "@tanstack/react-router";
import { ProjectFieldsPage } from "@/projects";

export const Route = createFileRoute(
  "/_layout/_authenticated/$slug/settings/projects/$key/fields",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { workspace } = Route.useRouteContext();
  const { key } = Route.useParams();
  return <ProjectFieldsPage workspace={workspace} projectKey={key} />;
}
