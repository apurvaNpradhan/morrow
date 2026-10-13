import { useMutation } from "@tanstack/react-query";
import { rpc } from "@/app/lib/orpc";
import { SlugUnavailableError } from "@/workspace/routing/lib/workspace-slug-error";

type CreateWorkspaceRequest = {
  name: string;
  slug: string;
  description?: string;
};

/** Creates a workspace with exactly the chosen slug; losing a race for it surfaces as `SlugUnavailableError`. */
export function useCreateWorkspace() {
  return useMutation({
    mutationFn: async ({ name, slug, description }: CreateWorkspaceRequest) => {
      try {
        return await rpc.workspace.create({
          name,
          slug,
          description: description || undefined,
        });
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
