import { cn } from "@/design-system/cn";

/** Share of the limit at which the count starts to show. */
const SHOW_AT = 0.9;

/**
 * The markdown length of a text against the limit the API enforces. Hidden
 * until the text is near the limit; red once it is over.
 */
export function DescriptionCharacterCount({
  count,
  limit,
}: {
  count: number;
  limit: number;
}) {
  if (count < limit * SHOW_AT) return null;
  const over = count > limit;
  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        "text-right text-xs tabular-nums text-muted-foreground",
        over && "text-red-600 dark:text-red-400",
      )}
    >
      {count.toLocaleString("en-US")} / {limit.toLocaleString("en-US")}
    </p>
  );
}
