import { createFileRoute, Outlet } from "@tanstack/react-router";

// Project settings act on the projects of the workspace in the URL.
export const Route = createFileRoute(
  "/_layout/_authenticated/$slug/settings/projects",
)({
  component: Outlet,
});
