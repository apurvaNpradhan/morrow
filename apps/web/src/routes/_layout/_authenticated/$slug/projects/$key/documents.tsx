import { createFileRoute } from "@tanstack/react-router";
import { ProjectDocumentsPage } from "@/documents";

export const Route = createFileRoute(
  "/_layout/_authenticated/$slug/projects/$key/documents",
)({ component: RouteComponent });

function RouteComponent() {
  const { workspace } = Route.useRouteContext();
  const { key } = Route.useParams();
  return <ProjectDocumentsPage workspace={workspace} projectKey={key} />;
}
