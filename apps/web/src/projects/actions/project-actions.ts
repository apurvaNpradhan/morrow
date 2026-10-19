import type { ColumnColor } from "@morrow/sync-schemas";
import { rpc } from "@/app/lib/orpc";
import { projectColumnCollection } from "../collections/project-column-collection";
import { projectCollection } from "../collections/project-collection";

type NewProject = {
  workspaceId: string;
  name: string;
  key: string;
  icon?: string;
  color?: ColumnColor;
};

/**
 * Creates a project. Its id, position and default columns come from the
 * server, so this waits for both tables to deliver it instead of inserting a
 * guess. Resolves with the new project's id.
 */
export async function createProject(input: NewProject) {
  const { id, txid } = await rpc.projects.create({
    workspaceId: input.workspaceId,
    name: input.name,
    key: input.key,
    ...(input.icon && { icon: input.icon }),
    ...(input.color && { color: input.color }),
  });
  await Promise.all([
    projectCollection.utils.awaitTxId(txid),
    projectColumnCollection.utils.awaitTxId(txid),
  ]);
  return id;
}

type ProjectPatch = {
  name?: string;
  description?: string | null;
  icon?: string | null;
  color?: ColumnColor | null;
  key?: string;
  position?: string;
  archivedAt?: Date | null;
};

/**
 * Edits a project (rename, icon, key, reorder, archive). The change shows at
 * once and rolls back if the server refuses it; resolves when it has come back
 * through sync.
 */
export async function updateProject(projectId: string, patch: ProjectPatch) {
  const transaction = projectCollection.update(projectId, (draft) => {
    Object.assign(draft, patch);
  });
  await transaction.isPersisted.promise;
}

/** Deletes an archived project. */
export async function deleteProject(projectId: string) {
  await projectCollection.delete(projectId).isPersisted.promise;
}
