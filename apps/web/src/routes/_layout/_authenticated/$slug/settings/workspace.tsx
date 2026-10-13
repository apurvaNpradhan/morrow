import { createFileRoute, Outlet } from "@tanstack/react-router";

// Workspace settings act on the workspace in the URL, so there is nothing to
// resolve from the session here.
export const Route = createFileRoute(
  "/_layout/_authenticated/$slug/settings/workspace",
)({
  component: Outlet,
});
