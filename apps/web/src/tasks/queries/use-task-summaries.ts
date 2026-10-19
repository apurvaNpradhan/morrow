import type { ProjectColumnRow, TaskRow } from "@morrow/sync-schemas";
import { inArray, useLiveQuery } from "@tanstack/react-db";
import {
  projectColumnCollection,
  useProjectsWithoutSuspense,
} from "@/projects";
import { useTasksByIds } from "./use-task-queries";

export type TaskSummary = {
  task: TaskRow;
  ticketId: string;
  column: ProjectColumnRow | undefined;
};

/**
 * Tasks of the Workspace, in any Project, with their ticket id and Column, by
 * task id; a task that has not loaded yet is missing from the map.
 */
export function useTaskSummaries(
  workspaceId: string,
  taskIds: readonly string[],
): Map<string, TaskSummary> {
  const tasks = useTasksByIds(taskIds);
  const projects = useProjectsWithoutSuspense(workspaceId);
  const columnIds = [...new Set(tasks.map((task) => task.columnId))];
  const { data: columns } = useLiveQuery({
    query: (q) =>
      columnIds.length === 0
        ? undefined
        : q
            .from({ column: projectColumnCollection })
            .where(({ column }) => inArray(column.id, columnIds)),
  });

  const keyOf = new Map(projects.map((project) => [project.id, project.key]));
  const columnOf = new Map(
    (columns ?? []).map((column) => [column.id, column]),
  );
  const summaries = new Map<string, TaskSummary>();
  for (const task of tasks) {
    summaries.set(task.id, {
      task,
      ticketId: `${keyOf.get(task.projectId) ?? ""}-${task.number}`,
      column: columnOf.get(task.columnId),
    });
  }
  return summaries;
}
