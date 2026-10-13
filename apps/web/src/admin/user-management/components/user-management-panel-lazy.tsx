import { lazy, Suspense } from "react";

// Heavy and only administrators open it, so the rest of the app gets this thin
// wrapper and the real panel loads on first use.
const Panel = lazy(() =>
  import("./user-management-panel").then((m) => ({
    default: m.UserManagementPanel,
  })),
);

export function UserManagementPanel() {
  return (
    <Suspense fallback={null}>
      <Panel />
    </Suspense>
  );
}
