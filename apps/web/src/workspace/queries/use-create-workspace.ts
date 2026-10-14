import { isChangeMessage } from "@tanstack/electric-db-collection";
import { useMutation } from "@tanstack/react-query";
import { rpc } from "@/app/lib/orpc";
import { useAuth } from "@/auth";
import { waitForMembership } from "@/members";
import { workspaceCollection } from "../collections/workspace-collection";
import { SlugUnavailableError } from "@/workspace/routing/lib/workspace-slug-error";

async function waitForWorkspace(workspaceId: string) {
  if (workspaceCollection.has(workspaceId)) return;
  await workspaceCollection.utils.awaitMatch(
    (message) =>
      isChangeMessage(message) &&
      message.headers.operation === "insert" &&
      message.value.id === workspaceId,
    5_000,
  );
}

type CreateWorkspaceRequest = {
  name: string;
  slug: string;
  description?: string;
};

/** Creates a workspace with exactly the chosen slug; losing a race for it surfaces as `SlugUnavailableError`. */
export function useCreateWorkspace() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ name, slug, description }: CreateWorkspaceRequest) => {
      try {
        const created = await rpc.workspace.create({
          name,
          slug,
          description: description || undefined,
        });
        // Open it only once the workspace and the creator's membership have
        // come back through sync, so the page finds both.
        await Promise.all([
          waitForWorkspace(created.id),
          waitForMembership(created.id, user?.id ?? ""),
        ]);
        return created;
      } catch (error) {
        // A concurrent create can win the slug between the live check and this
        // write; the database refuses it with a generic error, so look again.
        const availability = await rpc.workspace
          .slugAvailability({ slug })
          .catch(() => null);
        if (availability && !availability.available) {
          throw new SlugUnavailableError(availability.reason);
        }
        throw error;
      }
    },
  });
}
