import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceRolesPage } from "@/members";

export const Route = createFileRoute(
  "/_layout/_authenticated/$slug/settings/workspace/roles",
)({
  component: WorkspaceRolesPage,
});
