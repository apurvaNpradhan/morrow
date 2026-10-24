import {
  and,
  createLiveQueryCollection,
  eq,
  inArray,
  isNull,
} from "@tanstack/react-db";
import { onSyncedCollectionsCleared } from "@/app/sync/synced-collections";
import { taskCollection } from "../collections/task-collection";

/*
 * Every read of the on-demand task collection is a live query with a `where`,
 * and each one is created once per argument so that a route loader and the
 * page it loads share it: `preload()` on the collection itself does nothing
 * for an on-demand collection, but preloading a live query loads its subset.
 */

const cache = new Map<string, unknown>();

function once<T>(key: string, create: () => T): T {
  if (!cache.has(key)) cache.set(key, create());
  return cache.get(key) as T;
}

// Signing out clears the collection; the queries over it start afresh.
onSyncedCollectionsCleared(() => cache.clear());

/**
 * A Project's unarchived tasks in the given Columns: the list's groups. Its
 * open groups load at once; the done and canceled ones only once expanded.
 */
export function columnsTasks(projectId: string, columnIds: readonly string[]) {
  return once(`columns:${projectId}:${columnIds.join(",")}`, () =>
    createLiveQueryCollection((q) =>
      q
        .from({ task: taskCollection })
        .where(({ task }) =>
          and(
            eq(task.projectId, projectId),
            isNull(task.archivedAt),
            inArray(task.columnId, [...columnIds]),
          ),
        ),
    ),
  );
}

/** One Column's unarchived tasks: a collapsed group, once expanded. */
export function columnTasks(columnId: string) {
  return once(`column:${columnId}`, () =>
    createLiveQueryCollection((q) =>
      q
        .from({ task: taskCollection })
        .where(({ task }) =>
          and(eq(task.columnId, columnId), isNull(task.archivedAt)),
        ),
    ),
  );
}

/** One Project's task by ticket number: the full page's whole read. */
export function ticketTask(projectId: string, number: number) {
  return once(`ticket:${projectId}:${number}`, () =>
    createLiveQueryCollection((q) =>
      q
        .from({ task: taskCollection })
        .where(({ task }) =>
          and(eq(task.projectId, projectId), eq(task.number, number)),
        ),
    ),
  );
}

/** Every task of a Project, archived and closed ones included: what a move counts and checks. */
export function projectTasks(projectId: string) {
  return once(`project:${projectId}`, () =>
    createLiveQueryCollection((q) =>
      q
        .from({ task: taskCollection })
        .where(({ task }) => eq(task.projectId, projectId)),
    ),
  );
}
