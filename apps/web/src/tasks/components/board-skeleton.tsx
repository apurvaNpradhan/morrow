import { Skeleton } from "@/design-system/ui/skeleton";
import { ToolbarSkeleton } from "./toolbar-skeleton";

/** Cards per lane, as on a board: three open lanes, then the collapsed closed ones. */
const LANES = [
  { id: "todo", cards: ["a", "b", "c"] },
  { id: "doing", cards: ["a", "b"] },
  { id: "review", cards: ["a", "b", "c", "d"] },
  { id: "done", cards: [] },
  { id: "canceled", cards: [] },
];
/** Title width of each card, cycled, so the cards don't look stamped. */
const TITLE_WIDTHS = ["w-11/12", "w-3/4", "w-5/6", "w-2/3"];

function CardSkeleton({ index }: { index: number }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-2.5 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="size-5 rounded-full" />
      </div>
      <Skeleton
        className={`h-4 ${TITLE_WIDTHS[index % TITLE_WIDTHS.length]}`}
      />
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-5 w-6" />
        <Skeleton className="h-5 w-14" />
      </div>
    </div>
  );
}

/** What a board shows while its tasks load: the toolbar, then lanes of cards. */
export function BoardSkeleton() {
  return (
    <div aria-busy="true" className="flex h-full min-h-0 flex-col">
      <ToolbarSkeleton />
      <div className="flex min-h-96 flex-1 gap-3 overflow-hidden p-4">
        {LANES.map(({ id, cards }, lane) => (
          <div
            key={id}
            className={`flex w-72 shrink-0 flex-col self-start rounded-xl border bg-card/80 ${cards.length > 0 ? "h-full" : ""}`}
          >
            <div
              className={`flex items-center gap-2 px-3 py-2 ${cards.length > 0 ? "border-b" : ""}`}
            >
              <Skeleton className="size-5" />
              <Skeleton className="size-3.5 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="ms-auto h-3 w-4" />
            </div>
            {cards.length > 0 ? (
              <div className="flex flex-col gap-2 p-2">
                {cards.map((card, at) => (
                  <CardSkeleton key={card} index={lane + at} />
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
