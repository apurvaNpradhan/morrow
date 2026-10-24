import type { ProjectRow, TaskRow } from "@morrow/sync-schemas";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { toast } from "@/design-system/toast";
import { useTaskView } from "../components/task-view-context";
import type { MovePlan } from "../lib/move-plan";
import { moveTasksToProject, type MoveResult } from "./move-actions";

export type MoveJob = {
  /** The Tasks the user picked. */
  selected: readonly TaskRow[];
  plan: MovePlan;
  to: ProjectRow;
  /** A Column of the destination for the picked Tasks. */
  columnId?: string;
  withSubtasks: boolean;
};

/**
 * Moves Tasks to another Project and says so: a toast that opens the Task in
 * its new Project and, when no Field value was dropped, undoes the move. A
 * refusal rolls the cards back and shows a message.
 */
export function useMoveTasks() {
  const { t } = useTranslation("tasks");
  const navigate = useNavigate();
  const { workspace, project: from } = useTaskView();

  return useCallback(
    async (job: MoveJob) => {
      const moving = new Set(job.plan.tasks.map((task) => task.id));
      let result: MoveResult;
      try {
        result = await moveTasksToProject({
          workspaceId: workspace.id,
          toProjectId: job.to.id,
          taskIds: job.selected.map((task) => task.id),
          columnId: job.columnId,
          withSubtasks: job.withSubtasks,
          placements: new Map(
            job.plan.tasks.map((task) => [
              task.id,
              {
                columnId: job.plan.columnOf.get(task.id)!.id,
                parentId:
                  task.parentId && moving.has(task.parentId)
                    ? task.parentId
                    : null,
              },
            ]),
          ),
        });
      } catch (error) {
        toast.error(errorMessage(t, error, t("errors.generic")));
        return false;
      }

      const [only] = result.moved;
      const open = () =>
        void navigate(
          job.selected.length === 1 && only
            ? {
                to: "/$slug/tasks/$ticketId",
                params: { slug: workspace.slug, ticketId: only.toTicketId },
              }
            : {
                to: "/$slug/projects/$key/board",
                params: { slug: workspace.slug, key: job.to.key },
              },
        );
      // Values that were dropped cannot come back, so there is nothing to undo to.
      const lossless = result.moved.every(
        (task) => task.droppedValues.length === 0,
      );
      // Back into the Column they came from, when that was one Column; else by state.
      const sourceColumns = new Set(
        job.plan.tasks.map((task) => task.columnId),
      );
      const undo = async () => {
        try {
          await moveTasksToProject({
            workspaceId: workspace.id,
            toProjectId: from.id,
            taskIds: result.moved.map((task) => task.taskId),
            columnId:
              sourceColumns.size === 1 ? [...sourceColumns][0] : undefined,
            withSubtasks: false,
            placements: new Map(),
          });
          toast.success(t("move.undone"));
        } catch (error) {
          toast.error(errorMessage(t, error, t("errors.generic")));
        }
      };
      toast.success(
        t("move.done", { count: result.moved.length, project: job.to.name }),
        {
          action: {
            label: t("move.open", { project: job.to.name }),
            onClick: open,
          },
          cancel: lossless
            ? { label: t("move.undo"), onClick: () => void undo() }
            : undefined,
        },
      );
      return true;
    },
    [t, navigate, workspace.id, workspace.slug, from.id],
  );
}
