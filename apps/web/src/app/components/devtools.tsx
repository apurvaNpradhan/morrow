import { TanStackDevtools } from "@tanstack/react-devtools";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import type { AnyRouter } from "@tanstack/react-router";
import { SyncPanel } from "@/app/devtools/sync/sync-panel";

/** The dev-only TanStack devtools dock: one panel per TanStack library in use. */
export function Devtools({ router }: { router: AnyRouter }) {
  return (
    <TanStackDevtools
      plugins={[
        { name: "TanStack Query", render: <ReactQueryDevtoolsPanel /> },
        { name: "Sync", render: <SyncPanel /> },
        {
          name: "TanStack Router",
          render: <TanStackRouterDevtoolsPanel router={router} />,
        },
      ]}
    />
  );
}
