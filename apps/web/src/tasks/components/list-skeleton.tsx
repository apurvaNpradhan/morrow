import { Skeleton } from "@/design-system/ui/skeleton";
import { ToolbarSkeleton } from "./toolbar-skeleton";

/** Rows per group, as in a list: the open groups first, then the collapsed ones. */
const GROUPS = [
  { id: "todo", rows: ["a", "b", "c", "d"] },
  { id: "doing", rows: ["a", "b", "c"] },
  { id: "review", rows: ["a", "b", "c", "d", "e"] },
  { id: "done", rows: [] },
  { id: "canceled", rows: [] },
];
/** Title width of each row, cycled, so the rows don't look stamped. */
const TITLE_WIDTHS = ["w-2/5", "w-1/3", "w-1/2", "w-1/4", "w-3/5"];

function RowSkeleton({ index }: { index: number }) {
  return (
    <div className="flex h-9 items-center gap-2 border-b px-4">
      <Skeleton className="size-4" />
      <Skeleton className="h-3 w-16 shrink-0" />
      <Skeleton className="size-4 rounded-full" />
      <Skeleton
        className={`h-4 ${TITLE_WIDTHS[index % TITLE_WIDTHS.length]}`}
      />
      <Skeleton className="ms-auto h-4 w-14" />
      <Skeleton className="size-5 rounded-full" />
    </div>
  );
}

/** What a list shows while its tasks load: the toolbar, then group headers over rows. */
export function ListSkeleton() {
  return (
    <div aria-busy="true" className="flex h-full min-h-0 flex-col">
      <ToolbarSkeleton />
      <div className="min-h-0 flex-1 overflow-hidden">
        {GROUPS.map(({ id, rows }, group) => (
          <div key={id}>
            <div className="flex h-9 items-center gap-2 border-b bg-muted/30 px-3.5">
              <Skeleton className="size-5" />
              <Skeleton className="size-3.5 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-4" />
            </div>
            {rows.map((row, at) => (
              <RowSkeleton key={row} index={group + at} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
