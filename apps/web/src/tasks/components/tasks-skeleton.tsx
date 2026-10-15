import { Skeleton } from "@/design-system/ui/skeleton";

/** What the page shows while a Project's tasks load: rows where they will be. */
export function TasksSkeleton() {
  return (
    <div aria-busy="true" className="space-y-1 p-4">
      {Array.from({ length: 14 }, (_, row) => (
        <Skeleton key={row} className="h-8 w-full" />
      ))}
    </div>
  );
}
