import {
  compareColumns,
  isClosedCategory,
  type ProjectColumnRow,
} from "@morrow/sync-schemas";
import {
  projectCollection,
  projectColumnCollection,
  projectFieldCollection,
} from "@/projects";
import { columnsTasks } from "../queries/task-queries";

/** The ids of a Project's columns that are not done or canceled, in board order. */
export function openColumnIds(columns: readonly ProjectColumnRow[]) {
  return [...columns]
    .sort(compareColumns)
    .filter((column) => !isClosedCategory(column.category))
    .map((column) => column.id);
}

/**
 * Starts loading what a Project's board or list shows (its open Columns' tasks;
 * done and canceled ones load when expanded), for the route loader, so the
 * page renders with its tasks instead of waiting for them. A Project that does
 * not exist loads nothing; the page says so.
 */
export async function preloadProjectTasks(
  workspaceId: string,
  projectKey: string,
) {
  await Promise.all([
    projectCollection.preload(),
    projectColumnCollection.preload(),
    projectFieldCollection.preload(),
  ]);
  const project = projectCollection.toArray.find(
    (candidate) =>
      candidate.workspaceId === workspaceId &&
      candidate.key === projectKey.toUpperCase(),
  );
  if (!project) return;
  const columns = projectColumnCollection.toArray.filter(
    (column) => column.projectId === project.id,
  );
  await columnsTasks(project.id, openColumnIds(columns)).preload();
}
