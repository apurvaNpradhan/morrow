import { createFileRoute, Outlet } from "@tanstack/react-router";

/** A Project's address: its board and list are the pages inside it. */
export const Route = createFileRoute(
  "/_layout/_authenticated/$slug/projects/$key",
)({ component: Outlet });
