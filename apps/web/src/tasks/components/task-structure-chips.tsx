import type { TaskRow } from "@morrow/sync-schemas";
import { Ban, CornerLeftUp, ListTree } from "lucide-react";
import { useTranslation } from "react-i18next";
import { displayTicketId } from "../lib/task-links";
import { useTask } from "../queries/use-task-queries";
import { TaskChip } from "./task-chip";
import { useTaskView } from "./task-view-context";

/** The parent's ticket id on a subtask. Only a subtask looks its parent up. */
function ParentChip({ parentId }: { parentId: string }) {
  const { t } = useTranslation("tasks");
  const { project } = useTaskView();
  const parent = useTask(parentId);
  if (!parent) return null;
  const id = displayTicketId(project.key, parent.number);
  return (
    <TaskChip label={t("card.parent", { id })}>
      <CornerLeftUp aria-hidden="true" className="size-3" />
      {id}
    </TaskChip>
  );
}

/**
 * What a task says about the tree and the dependencies it is in, for a card
 * or row: its parent's ticket id, how many of its subtasks are closed, and a
 * mark while a blocker is open. The counters ride on the task row; a finished
 * task is not blocked.
 */
export function TaskStructureChips({
  task,
  closed,
}: {
  task: TaskRow;
  closed: boolean;
}) {
  const { t } = useTranslation("tasks");
  return (
    <>
      {task.parentId ? <ParentChip parentId={task.parentId} /> : null}
      {task.subtaskTotal > 0 ? (
        <TaskChip label={t("card.subtasks")}>
          <ListTree aria-hidden="true" className="size-3" />
          {task.subtaskDone}/{task.subtaskTotal}
        </TaskChip>
      ) : null}
      {task.openBlockerCount > 0 && !closed ? (
        <TaskChip
          label={t("card.blocked", { count: task.openBlockerCount })}
          tone="danger"
        >
          <Ban aria-hidden="true" className="size-3" />
          {t("card.blockedMark")}
        </TaskChip>
      ) : null}
    </>
  );
}
