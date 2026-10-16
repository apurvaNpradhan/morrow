import type { TaskRow } from "@morrow/sync-schemas";
import {
  and,
  eq,
  inArray,
  isNull,
  not,
  useLiveQuery,
  useLiveSuspenseQuery,
} from "@tanstack/react-db";
import { taskCollection } from "../collections/task-collection";
import { taskDescriptionCollection } from "../collections/task-description-collection";
import { columnsTasks } from "./task-queries";

/** The tasks of the open Columns, for the board and the list; the route loader has preloaded them. */
export function useOpenColumnsTasks(
  projectId: string,
  openColumnIds: readonly string[],
): TaskRow[] {
  return useLiveSuspenseQuery(columnsTasks(projectId, openColumnIds)).data;
}

/**
 * The tasks of the expanded done and canceled groups. Nothing is loaded for a
 * collapsed group, so closed work costs nothing until it is opened.
 */
export function useExpandedColumnsTasks(
  projectId: string,
  expandedColumnIds: readonly string[],
) {
  const enabled = expandedColumnIds.length > 0;
  const { data, isLoading } = useLiveQuery({
    query: (q) =>
      enabled
        ? q
            .from({ task: taskCollection })
            .where(({ task }) =>
              and(
                eq(task.projectId, projectId),
                isNull(task.archivedAt),
                inArray(task.columnId, [...expandedColumnIds]),
              ),
            )
        : undefined,
  });
  return { tasks: data ?? [], isLoading: enabled && isLoading };
}

/** The Archived group's tasks, loaded only once it is expanded. */
export function useArchivedTasks(projectId: string, enabled: boolean) {
  const { data, isLoading } = useLiveQuery({
    query: (q) =>
      enabled
        ? q
            .from({ task: taskCollection })
            .where(({ task }) =>
              and(eq(task.projectId, projectId), not(isNull(task.archivedAt))),
            )
        : undefined,
  });
  return { tasks: data ?? [], isLoading: enabled && isLoading };
}

/** The task with this number, undefined while it loads or when there is none. */
export function useTicketTask(projectId: string, number: number | null) {
  const { data, isReady } = useLiveQuery({
    query: (q) =>
      number === null
        ? undefined
        : q
            .from({ task: taskCollection })
            .where(({ task }) =>
              and(eq(task.projectId, projectId), eq(task.number, number)),
            ),
  });
  return { task: data?.[0], isReady };
}

/** A task's description, undefined until it has loaded. */
export function useTaskDescription(taskId: string) {
  const { data } = useLiveQuery({
    query: (q) =>
      q
        .from({ description: taskDescriptionCollection })
        .where(({ description }) => eq(description.taskId, taskId)),
  });
  return data[0]?.description;
}

/** One task by id, live; undefined while it loads or when there is none. */
export function useTask(taskId: string) {
  const { data } = useLiveQuery({
    query: (q) =>
      q.from({ task: taskCollection }).where(({ task }) => eq(task.id, taskId)),
  });
  return data?.[0];
}
