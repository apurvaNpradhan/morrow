import { Skeleton } from "@/design-system/ui/skeleton";

/** The toolbar's shape while tasks load: the count on the left, search and two buttons on the right. */
export function ToolbarSkeleton() {
  return (
    <div className="border-b">
      <div className="flex items-center gap-2 px-4 py-2">
        <Skeleton className="me-auto h-3 w-16" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-7 w-20" />
      </div>
    </div>
  );
}
