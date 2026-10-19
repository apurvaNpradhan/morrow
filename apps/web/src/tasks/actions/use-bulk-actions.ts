import { MAX_BULK_TASKS, type TaskPriority } from "@morrow/sync-schemas";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { toast } from "@/design-system/toast";
import { useTaskView } from "../components/task-view-context";
import { selectedTasks } from "../lib/selected-tasks";
import {
  bulkRemoveTasks,
  bulkUpdateTasks,
  type BulkChange,
} from "./bulk-actions";

/**
 * What the selection offers, applied to the selected tasks that are shown. A
 * refusal rolls the whole batch back and shows a message; only deleting shows
 * a message on success.
 */
export function useBulkActions() {
  const { t } = useTranslation("tasks");
  const { project, columnById } = useTaskView();

  return useMemo(() => {
    function batch() {
      const tasks = selectedTasks(project.id);
      return {
        tasks,
        input: {
          projectId: project.id,
          taskIds: tasks.map((task) => task.id),
          columnById,
        },
      };
    }
    async function attempt(run: () => Promise<unknown>) {
      try {
        await run();
        return true;
      } catch (error) {
        toast.error(errorMessage(t, error, t("errors.generic")));
        return false;
      }
    }
    const update = (change: BulkChange) => {
      const { tasks, input } = batch();
      if (tasks.length === 0 || tasks.length > MAX_BULK_TASKS) {
        return Promise.resolve(false);
      }
      return attempt(() => bulkUpdateTasks(input, change));
    };

    return {
      setPriority: (priority: TaskPriority) =>
        update({ type: "priority", priority }),
      setColumn: (columnId: string) => update({ type: "move", columnId }),
      setAssignee: (assigneeId: string | null) =>
        update({ type: "assignee", assigneeId }),
      setDueDate: (dueDate: string | null) =>
        update({ type: "dueDate", dueDate }),
      addLabel: (labelId: string) => update({ type: "addLabel", labelId }),
      removeLabel: (labelId: string) =>
        update({ type: "removeLabel", labelId }),
      archive: (archived: boolean) => update({ type: "archive", archived }),
      /** Deletes the given tasks as one write; shows "Deleted N tasks". */
      remove: async (tasks: { id: string }[]) => {
        const done = await attempt(() =>
          bulkRemoveTasks({
            projectId: project.id,
            taskIds: tasks.map((task) => task.id),
            columnById,
          }),
        );
        if (done) toast.success(t("delete.bulkDone", { count: tasks.length }));
        return done;
      },
    };
  }, [t, project.id, columnById]);
}
