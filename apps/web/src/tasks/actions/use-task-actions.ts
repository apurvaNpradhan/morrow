import type { FieldValue, TaskPriority, TaskRow } from "@morrow/sync-schemas";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { copyToClipboard } from "@/design-system/copy-to-clipboard";
import { toast } from "@/design-system/toast";
import { useTaskView } from "../components/task-view-context";
import { useCreatedToast } from "./use-created-toast";
import {
  archiveCompleted,
  archiveTask,
  deleteTask,
  duplicateTask,
  moveTask,
  moveTaskToColumn,
  unarchiveTask,
  updateTask,
} from "./task-actions";
import { setTaskFieldValue } from "./set-task-field-value";
import { toggleTaskLabel } from "./toggle-task-label";

/**
 * The edits a task offers wherever it is shown (card, row, context menu,
 * sheet, shortcuts). Each shows at once; a refusal rolls it back and shows a
 * message.
 */
export function useTaskActions() {
  const { t } = useTranslation("tasks");
  const { project, columnById, meId } = useTaskView();
  const showCreated = useCreatedToast();

  return useMemo(() => {
    async function attempt(run: () => Promise<unknown>) {
      try {
        await run();
        return true;
      } catch (error) {
        toast.error(errorMessage(t, error, t("errors.generic")));
        return false;
      }
    }

    return {
      setPriority: (task: TaskRow, priority: TaskPriority) =>
        attempt(() => updateTask(task.id, { priority })),
      setDueDate: (task: TaskRow, dueDate: string | null) =>
        attempt(() => updateTask(task.id, { dueDate })),
      setAssignee: (task: TaskRow, assigneeId: string | null) =>
        attempt(() => updateTask(task.id, { assigneeId })),
      /** `null` makes the task a top-level one again. */
      setParent: (task: TaskRow, parentId: string | null) =>
        attempt(() => updateTask(task.id, { parentId })),
      /** Sets a Field's value (an option id for a choice), or clears it with null. */
      setFieldValue: (
        task: TaskRow,
        fieldId: string,
        value: FieldValue | null,
      ) => attempt(() => setTaskFieldValue(task.id, fieldId, value)),
      toggleLabel: (task: TaskRow, labelId: string) =>
        attempt(() => toggleTaskLabel(task.id, labelId)),
      setColumn: (task: TaskRow, columnId: string) => {
        const column = columnById.get(columnId);
        const from = columnById.get(task.columnId);
        if (!column || !from) return Promise.resolve(false);
        return attempt(() => moveTaskToColumn(task, column, from));
      },
      /** A drop: a Column and a position, or the end of the Column when the sort decides. */
      drop: (task: TaskRow, columnId: string, position: string | null) => {
        const column = columnById.get(columnId);
        const from = columnById.get(task.columnId);
        if (!column || !from) return Promise.resolve(false);
        return attempt(() =>
          position === null
            ? moveTaskToColumn(task, column, from)
            : moveTask(task, { column, from, position }),
        );
      },
      archive: (task: TaskRow) => attempt(() => archiveTask(task.id)),
      unarchive: (task: TaskRow) => attempt(() => unarchiveTask(task.id)),
      remove: (task: TaskRow) => attempt(() => deleteTask(task.id)),
      archiveCompleted: async (columnId: string) => {
        let count = 0;
        const done = await attempt(async () => {
          count = await archiveCompleted(project.id, columnId);
        });
        if (done) toast.success(t("archiveCompleted.done", { count }));
        return done;
      },
      duplicate: async (task: TaskRow) => {
        let copy: TaskRow | undefined;
        const done = await attempt(async () => {
          copy = await duplicateTask(task, meId);
        });
        if (done && copy) showCreated(project.key, copy.number);
        return done;
      },
      copy: async (text: string) => {
        const copied = await copyToClipboard(text);
        if (copied) toast.success(t("copy.done"));
        else toast.error(t("copy.failed"));
      },
    };
  }, [t, showCreated, project.id, project.key, columnById, meId]);
}
