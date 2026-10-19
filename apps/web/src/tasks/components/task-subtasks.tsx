import { TASK_TITLE_MAX, type TaskRow } from "@morrow/sync-schemas";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { toast } from "@/design-system/toast";
import { Input } from "@/design-system/ui/input";
import { createTask } from "../actions/task-actions";
import { displayTicketId } from "../lib/task-links";
import { useSubtasks } from "../queries/use-task-queries";
import { LinkedTaskRow } from "./linked-task-row";
import { useTaskView } from "./task-view-context";

/**
 * The direct subtasks of a task, by number, with a box that adds one by title.
 * A new subtask starts in the Project's first To Do column. Nothing is shown to
 * a viewer when there are none.
 */
export function TaskSubtasks({ task }: { task: TaskRow }) {
  const { t } = useTranslation("tasks");
  const { project, columns, columnById, meId, can, frozen } = useTaskView();
  const subtasks = useSubtasks(task.id);
  const [title, setTitle] = useState("");
  const editable = can.create && !frozen;

  if (subtasks.length === 0 && !editable) return null;

  async function add() {
    const next = title.trim();
    const column =
      columns.find((candidate) => candidate.category === "unstarted") ??
      columns[0];
    if (next === "" || !column) return;
    setTitle("");
    try {
      await createTask({
        projectId: project.id,
        column,
        title: next,
        parentId: task.id,
        userId: meId,
      });
    } catch (error) {
      toast.error(errorMessage(t, error, t("subtasks.error")));
    }
  }

  return (
    <section aria-label={t("subtasks.title")} className="space-y-1.5">
      <h2 className="text-xs font-medium text-muted-foreground">
        {t("subtasks.title")}
        {task.subtaskTotal > 0 ? (
          <span className="ms-2 tabular-nums">
            {task.subtaskDone}/{task.subtaskTotal}
          </span>
        ) : null}
      </h2>
      {subtasks.length > 0 ? (
        <ul className="space-y-0.5">
          {subtasks.map((subtask) => (
            <LinkedTaskRow
              key={subtask.id}
              task={subtask}
              ticketId={displayTicketId(project.key, subtask.number)}
              column={columnById.get(subtask.columnId)}
            />
          ))}
        </ul>
      ) : null}
      {editable ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void add();
          }}
        >
          <Input
            size="sm"
            value={title}
            maxLength={TASK_TITLE_MAX}
            placeholder={t("subtasks.placeholder")}
            aria-label={t("subtasks.add")}
            onChange={(event) => setTitle(event.target.value)}
          />
        </form>
      ) : null}
    </section>
  );
}
