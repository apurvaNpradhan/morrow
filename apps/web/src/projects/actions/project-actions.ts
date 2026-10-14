import type { ProjectIcon } from "@morrow/sync-schemas";
import { rpc } from "@/app/lib/orpc";
import { projectColumnCollection } from "../collections/project-column-collection";
import { projectCollection } from "../collections/project-collection";

/** Resolves once the change has been written, synced back and the optimistic copy dropped. */
async function persisted(transaction: {
  isPersisted: { promise: Promise<unknown> };
}) {
  await transaction.isPersisted.promise;
}

type NewProject = {
  workspaceId: string;
  name: string;
  key: string;
  icon?: ProjectIcon;
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
  icon?: ProjectIcon | null;
  key?: string;
};

/** Edits a project; the change shows at once and rolls back if the server refuses it. */
export function updateProject(projectId: string, patch: ProjectPatch) {
  return persisted(
    projectCollection.update(projectId, (draft) => {
      Object.assign(draft, patch);
    }),
  );
}

/** Gives a project the position computed from its new neighbours. */
export function moveProject(projectId: string, position: string) {
  return persisted(
    projectCollection.update(projectId, (draft) => {
      draft.position = position;
    }),
  );
}

export function setProjectArchived(projectId: string, archived: boolean) {
  return persisted(
    projectCollection.update(projectId, (draft) => {
      draft.archivedAt = archived ? new Date() : null;
    }),
  );
}

export function deleteProject(projectId: string) {
  return persisted(projectCollection.delete(projectId));
}
