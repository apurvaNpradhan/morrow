import type { LabelRow } from "@morrow/sync-schemas";
import { cn } from "@/design-system/cn";
import { COLUMN_COLOR_CLASSES } from "@/projects";

/** A label as a small chip: a dot in its colour and its name. */
export function LabelChip({
  label,
  className,
}: {
  label: Pick<LabelRow, "name" | "color">;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 max-w-32 shrink-0 items-center gap-1 rounded-full border px-1.5 text-xs text-muted-foreground",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-2 shrink-0 rounded-full",
          COLUMN_COLOR_CLASSES[label.color].dot,
        )}
      />
      <span className="truncate">{label.name}</span>
    </span>
  );
}

/** A label's colour dot alone, for menus and lists. */
export function LabelDot({
  color,
  className,
}: {
  color: LabelRow["color"];
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "size-2.5 shrink-0 rounded-full",
        COLUMN_COLOR_CLASSES[color].dot,
        className,
      )}
    />
  );
}
