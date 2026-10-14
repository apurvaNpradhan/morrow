import { type ErrorComponentProps, useRouter } from "@tanstack/react-router";
import { ErrorDisplay } from "@/design-system/ui/error-display";

/** Shown when a Workspace page cannot load or sync; retrying reloads the route. */
export function WorkspaceError({ error }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <ErrorDisplay error={error} onRetry={() => void router.invalidate()} />
  );
}
