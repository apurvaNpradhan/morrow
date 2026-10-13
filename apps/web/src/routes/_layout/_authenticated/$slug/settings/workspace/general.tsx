import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceGeneralPage } from "@/workspace";

export const Route = createFileRoute(
  "/_layout/_authenticated/$slug/settings/workspace/general",
)({
  component: WorkspaceGeneralPage,
});
