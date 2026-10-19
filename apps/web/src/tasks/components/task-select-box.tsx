import type { TaskRow } from "@morrow/sync-schemas";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/design-system/cn";
import { toggleSelected } from "../lib/select-gesture";
import { useIsSelected } from "../lib/selection-store";
import { displayTicketId } from "../lib/task-links";
import { useTaskView } from "./task-view-context";

/** The checkbox that shows on hover (always while selected) on a card or row. */
export function TaskSelectBox({
  task,
  className,
}: {
  task: TaskRow;
  className?: string;
}) {
  const { t } = useTranslation("tasks");
  const { project } = useTaskView();
  const selected = useIsSelected(project.id, task.id);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-label={t("selection.toggle", {
        id: displayTicketId(project.key, task.number),
      })}
      tabIndex={-1}
      className={cn(
        "flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border bg-background outline-none transition-opacity group-hover/task:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-primary bg-primary text-primary-foreground opacity-100"
          : "opacity-0",
        className,
      )}
      onClick={(event) => {
        event.stopPropagation();
        toggleSelected(project.id, task.id);
      }}
      onKeyDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
    >
      {selected ? <Check aria-hidden="true" className="size-3" /> : null}
    </button>
  );
}
