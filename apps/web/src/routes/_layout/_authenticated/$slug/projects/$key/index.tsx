import { createFileRoute, redirect } from "@tanstack/react-router";
import { readDevicePreferences } from "@/app/preferences/use-device-preferences";

/** `/projects/MOR` opens the layout this device used last. */
export const Route = createFileRoute(
  "/_layout/_authenticated/$slug/projects/$key/",
)({
  beforeLoad: ({ params }) => {
    const { taskView } = readDevicePreferences();
    throw redirect({
      to:
        taskView === "list"
          ? "/$slug/projects/$key/list"
          : "/$slug/projects/$key/board",
      params,
      replace: true,
    });
  },
});
