import { z } from "zod";
import { authed, requireWorkspacePermission } from "#api/platform/orpc/base";
import { searchWorkspace } from "./operations/search-workspace";
import { searchResult } from "./response";

// Membership implies read, so reading the Workspace is the whole check.
const canRead = requireWorkspacePermission({ workspace: ["read"] });

const query = authed
  .input(
    z.object({
      workspaceId: z.string().min(1),
      q: z.string().max(200),
    }),
  )
  .use(canRead)
  .output(searchResult)
  .handler(({ input }) => searchWorkspace(input.workspaceId, input.q));

export const searchRouter = { query };
