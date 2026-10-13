import { createFileRoute } from "@tanstack/react-router";
import { ErrorTest } from "@/design-system/ui/error-test";

export const Route = createFileRoute("/test-error")({
  component: TestErrorComponent,
});

function TestErrorComponent() {
  return (
    <div className="min-h-screen bg-background">
      <ErrorTest />
    </div>
  );
}
