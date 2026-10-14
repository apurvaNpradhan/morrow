import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_layout/_authenticated/$slug/settings/projects/$key/",
)({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/$slug/settings/projects/$key/general",
      params,
      replace: true,
    });
  },
});
