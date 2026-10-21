import type { TaskRow } from "@morrow/sync-schemas";
import { useTranslation } from "react-i18next";
import { useTask } from "../queries/use-task-queries";
import { displayTicketId } from "../lib/task-links";
import { ColumnMarker } from "./column-marker";
import { ProgressRing } from "./progress-ring";
import { useTaskView } from "./task-view-context";

/**
 * Under a subtask's title: "Sub-issue of", its parent's status, ticket id and
 * title, which open the parent, and how many of the parent's subtasks are done.
 */
export function TaskParentLink({ task }: { task: TaskRow }) {
  const { t } = useTranslation("tasks");
  const view = useTaskView();
  const parent = useTask(task.parentId ?? "");
  if (!task.parentId || !parent) return null;
  const column = view.columnById.get(parent.columnId);
  const id = displayTicketId(view.project.key, parent.number);

  return (
    <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
      <span className="shrink-0">{t("parent.subtaskOf")}</span>
      <button
        type="button"
        aria-label={t("parent.open", { id })}
        className="flex min-w-0 cursor-pointer items-center gap-1.5 rounded-md text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => view.openTask(parent)}
      >
        {column ? <ColumnMarker column={column} /> : null}
        <span className="shrink-0 font-mono text-xs text-muted-foreground">
          {id}
        </span>
        <span className="truncate">{parent.title}</span>
      </button>
      {parent.subtaskTotal > 0 ? (
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs tabular-nums"
          title={t("card.subtasks")}
        >
          <ProgressRing done={parent.subtaskDone} total={parent.subtaskTotal} />
          {parent.subtaskDone}/{parent.subtaskTotal}
        </span>
      ) : null}
    </div>
  );
}
