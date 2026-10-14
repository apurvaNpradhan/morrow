import { createFileRoute, redirect } from "@tanstack/react-router";

// Members live with the workspace settings; this keeps old links working.
export const Route = createFileRoute("/_layout/_authenticated/$slug/members")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/$slug/settings/workspace/members",
      params,
      replace: true,
    });
  },
});
