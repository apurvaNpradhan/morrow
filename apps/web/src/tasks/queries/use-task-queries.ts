import type { TaskRow } from "@morrow/sync-schemas";
import {
  and,
  eq,
  inArray,
  isNull,
  not,
  or,
  useLiveQuery,
  useLiveSuspenseQuery,
} from "@tanstack/react-db";
import { useMemo } from "react";
import { taskCollection } from "../collections/task-collection";
import { taskCommentCollection } from "../collections/task-comment-collection";
import { taskRelationCollection } from "../collections/task-relation-collection";
import { taskAttachmentCollection } from "../collections/task-attachment-collection";
import { taskLinkCollection } from "../collections/task-link-collection";
import { taskEventCollection } from "../collections/task-event-collection";
import { parseEvents } from "../lib/timeline";
import { taskDescriptionCollection } from "../collections/task-description-collection";
import { useSelectedIds } from "../lib/selection-store";
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

/** The selected tasks, live, from the tasks the view already loaded; order is not the view's. */
export function useSelectedTasks(projectId: string) {
  const ids = [...useSelectedIds(projectId)];
  const { data } = useLiveQuery(
    {
      query: (q) =>
        q
          .from({ task: taskCollection })
          .where(({ task }) => inArray(task.id, ids)),
    },
    [ids.join(",")],
  );
  return ids.length === 0 ? [] : (data ?? []);
}

/** A task's comments, oldest first; loaded when the task is opened. */
export function useTaskComments(taskId: string) {
  const { data } = useLiveQuery({
    query: (q) =>
      q
        .from({ comment: taskCommentCollection })
        .where(({ comment }) => eq(comment.taskId, taskId))
        .orderBy(({ comment }) => comment.createdAt, "asc"),
  });
  return data ?? [];
}

/** A task's history, oldest first; loaded when the task is opened. */
export function useTaskEvents(taskId: string) {
  const { data } = useLiveQuery({
    query: (q) =>
      q
        .from({ event: taskEventCollection })
        .where(({ event }) => eq(event.taskId, taskId)),
  });
  return useMemo(() => parseEvents(data ?? []), [data]);
}

/** A task's external links, oldest first; loaded when the task is opened. */
export function useTaskLinks(taskId: string) {
  const { data } = useLiveQuery({
    query: (q) =>
      q
        .from({ link: taskLinkCollection })
        .where(({ link }) => eq(link.taskId, taskId))
        .orderBy(({ link }) => link.createdAt, "asc"),
  });
  return data ?? [];
}

/** A task's attached files, oldest first; loaded when the task is opened. */
export function useTaskAttachments(taskId: string) {
  const { data } = useLiveQuery({
    query: (q) =>
      q
        .from({ file: taskAttachmentCollection })
        .where(({ file }) => eq(file.taskId, taskId))
        .orderBy(({ file }) => file.attachedAt, "asc"),
  });
  return data ?? [];
}

/** A task's direct subtasks in ticket order; loaded when the task is opened. */
export function useSubtasks(taskId: string) {
  const { data } = useLiveQuery({
    query: (q) =>
      q
        .from({ task: taskCollection })
        .where(({ task }) => eq(task.parentId, taskId))
        .orderBy(({ task }) => task.number, "asc"),
  });
  return data ?? [];
}

/** The relations a task is on either end of; loaded when the task is opened. */
export function useTaskRelations(taskId: string) {
  const { data } = useLiveQuery({
    query: (q) =>
      q
        .from({ relation: taskRelationCollection })
        .where(({ relation }) =>
          or(
            eq(relation.sourceTaskId, taskId),
            eq(relation.targetTaskId, taskId),
          ),
        )
        .orderBy(({ relation }) => relation.createdAt, "asc"),
  });
  return data ?? [];
}

/** Tasks by id, wherever their Project; loads the ones not in memory yet. */
export function useTasksByIds(taskIds: readonly string[]) {
  const { data } = useLiveQuery({
    query: (q) =>
      taskIds.length === 0
        ? undefined
        : q
            .from({ task: taskCollection })
            .where(({ task }) => inArray(task.id, [...taskIds])),
  });
  return data ?? [];
}
