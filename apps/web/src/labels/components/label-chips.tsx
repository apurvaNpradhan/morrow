import type { LabelRow } from "@morrow/sync-schemas";
import { LabelChip } from "./label-chip";

/**
 * A task's labels as chips: the first few, then "+N" for the rest, so a card
 * stays compact. The overflow names the hidden labels for hover and screen readers.
 */
export function LabelChips({
  labels,
  max,
  chipClassName,
}: {
  labels: readonly LabelRow[];
  max: number;
  /** Sizes the chips where the default is too small, such as the task rail. */
  chipClassName?: string;
}) {
  if (labels.length === 0) return null;
  const shown = labels.slice(0, max);
  const hidden = labels.slice(max);
  return (
    <>
      {shown.map((label) => (
        <LabelChip key={label.id} label={label} className={chipClassName} />
      ))}
      {hidden.length > 0 ? (
        <span
          className="inline-flex h-5 shrink-0 items-center rounded-full border px-1.5 text-xs text-muted-foreground"
          title={hidden.map((label) => label.name).join(", ")}
        >
          +{hidden.length}
        </span>
      ) : null}
    </>
  );
}
