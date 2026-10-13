import { lazy, Suspense } from "react";

// Heavy and only administrators open it; see user-management-panel-lazy.tsx.
const Panel = lazy(() =>
  import("./workspace-management-panel").then((m) => ({
    default: m.WorkspaceManagementPanel,
  })),
);

export function WorkspaceManagementPanel() {
  return (
    <Suspense fallback={null}>
      <Panel />
    </Suspense>
  );
}
