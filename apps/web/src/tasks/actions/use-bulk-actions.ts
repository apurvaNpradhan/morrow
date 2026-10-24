import { MAX_BULK_TASKS, type TaskPriority } from "@morrow/sync-schemas";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { toast } from "@/design-system/toast";
import { useTaskView } from "../components/task-view-context";
import { dueFields, startsAfterDue } from "../lib/due-date";
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
    /** Whether the batch may go: not empty, and within the cap (said so when not). */
    function allowed(count: number) {
      if (count > MAX_BULK_TASKS) {
        toast.error(t("selection.capped", { max: MAX_BULK_TASKS }));
      }
      return count > 0 && count <= MAX_BULK_TASKS;
    }
    const update = (change: BulkChange) => {
      const { tasks, input } = batch();
      if (!allowed(tasks.length)) return Promise.resolve(false);
      return attempt(() => bulkUpdateTasks(input, change));
    };

    return {
      setPriority: (priority: TaskPriority) =>
        update({ type: "priority", priority }),
      setColumn: (columnId: string) => update({ type: "move", columnId }),
      setAssignee: (assigneeId: string | null) =>
        update({ type: "assignee", assigneeId }),
      setStartDate: (startDate: string | null) =>
        update({ type: "startDate", startDate }),
      /** A due date before a start takes the start with it, and says so. */
      setDueDate: async (dueDate: string | null) => {
        const due = dueFields(dueDate);
        const clearsStart = batch().tasks.some((task) =>
          startsAfterDue({ ...task, ...due }),
        );
        const done = await update({ type: "dueDate", dueDate });
        if (done && clearsStart) toast.info(t("due.startCleared"));
        return done;
      },
      addLabel: (labelId: string) => update({ type: "addLabel", labelId }),
      removeLabel: (labelId: string) =>
        update({ type: "removeLabel", labelId }),
      archive: (archived: boolean) => update({ type: "archive", archived }),
      /** Whether a batch of this size may go; tells the user when it is over the cap. */
      allowed,
      /** Deletes the given tasks as one write; shows "Deleted N tasks". */
      remove: async (tasks: { id: string }[]) => {
        if (!allowed(tasks.length)) return false;
        let deleted = 0;
        const done = await attempt(async () => {
          deleted = await bulkRemoveTasks({
            projectId: project.id,
            taskIds: tasks.map((task) => task.id),
            columnById,
          });
        });
        if (done) toast.success(t("delete.bulkDone", { count: deleted }));
        return done;
      },
    };
  }, [t, project.id, columnById]);
}
