import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { authed, requireWorkspacePermission } from "#api/platform/orpc/base";
import { listWorkspaceActivityPage } from "./recording/record-workspace-activity";

const workspaceActivityItemSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  resourceType: z.string(),
  resourceId: z.string(),
  type: z.string(),
  actorUserId: z.string().nullable(),
  actorName: z.string().nullable(),
  content: z.string(),
  eventData: z.record(z.string(), z.unknown()),
  createdAt: z.date(),
});

export const list = authed
  .input(
    z.object({
      workspaceId: z.string().min(1),
      limit: z.number().int().min(1).max(100).default(25),
      cursor: z.string().min(1).max(128).optional(),
    }),
  )
  .use(requireWorkspacePermission({ workspace: ["read"] }))
  .output(
    z.object({
      items: z.array(workspaceActivityItemSchema),
      nextCursor: z.string().nullable(),
    }),
  )
  .handler(async ({ input }) => {
    try {
      return await listWorkspaceActivityPage(input);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Invalid workspace activity cursor"
      ) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Invalid activity cursor or page size",
        });
      }
      throw error;
    }
  });

export const activityRouter = { list };
