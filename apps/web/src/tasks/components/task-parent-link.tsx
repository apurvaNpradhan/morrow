import type { TaskRow } from "@morrow/sync-schemas";
import { CornerLeftUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTask } from "../queries/use-task-queries";
import { displayTicketId } from "../lib/task-links";
import { useTaskView } from "./task-view-context";

/** Above a subtask's title: its parent's ticket id and title, which open the parent. */
export function TaskParentLink({ task }: { task: TaskRow }) {
  const { t } = useTranslation("tasks");
  const view = useTaskView();
  const parent = useTask(task.parentId ?? "");
  if (!task.parentId || !parent) return null;

  return (
    <button
      type="button"
      aria-label={t("parent.open", {
        id: displayTicketId(view.project.key, parent.number),
      })}
      className="flex max-w-full cursor-pointer items-center gap-1.5 rounded-md text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => view.openTask(parent)}
    >
      <CornerLeftUp aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="font-mono">
        {displayTicketId(view.project.key, parent.number)}
      </span>
      <span className="truncate">{parent.title}</span>
    </button>
  );
}
