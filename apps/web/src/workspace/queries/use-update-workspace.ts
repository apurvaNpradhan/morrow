import { useMutation } from "@tanstack/react-query";
import { workspaceCollection } from "../collections/workspace-collection";

type UpdateWorkspaceRequest = {
  workspaceId: string;
  name?: string;
  description?: string;
};

/**
 * Changes a workspace's name or description. The new text shows at once and
 * rolls back if the server rejects it; resolves when the change has come back
 * through sync.
 */
export function useUpdateWorkspace() {
  return useMutation({
    mutationFn: async ({
      workspaceId,
      name,
      description,
    }: UpdateWorkspaceRequest) => {
      const transaction = workspaceCollection.update(workspaceId, (draft) => {
        if (name !== undefined) draft.name = name;
        if (description !== undefined) draft.description = description;
      });
      await transaction.isPersisted.promise;
    },
  });
}
