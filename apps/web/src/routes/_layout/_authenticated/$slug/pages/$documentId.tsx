import { createFileRoute } from "@tanstack/react-router";
import { DocumentPage } from "@/documents";

export const Route = createFileRoute(
  "/_layout/_authenticated/$slug/pages/$documentId",
)({ component: RouteComponent });

function RouteComponent() {
  const { workspace, session } = Route.useRouteContext();
  const { documentId } = Route.useParams();
  return (
    <DocumentPage
      workspace={workspace}
      userId={session?.user.id ?? ""}
      documentId={documentId}
    />
  );
}
