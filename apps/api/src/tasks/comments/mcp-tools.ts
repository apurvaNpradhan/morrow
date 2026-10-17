import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { mcpTool } from "#api/platform/orpc/mcp-tool";
import { createId } from "@paralleldrive/cuid2";
import { resolveTask } from "#api/tasks/mcp-resolve";
import { commentBody } from "#api/tasks/schemas";

const task = {
  workspaceId: z.string().trim().min(1),
  projectId: z.string().trim().min(1),
  ticketId: z.string().trim().min(1),
};

export const commentsMcpTools = [
  mcpTool({
    name: "comment_task",
    description:
      "Add, edit or delete a comment on a task. Edit and delete take a commentId from get_task; you can only change your own comments.",
    inputSchema: z.object({
      ...task,
      action: z.enum(["add", "edit", "delete"]),
      commentId: z.string().optional(),
      body: commentBody.optional(),
    }),
    run: async ({ action, commentId, body, ...input }, client) => {
      const scope = await resolveTask(client, input, input.ticketId);
      if (action === "add") {
        if (!body) throw missing("body");
        const { id } = await client.comments.create({
          ...scope,
          id: createId(),
          body,
        });
        return { commentId: id };
      }
      if (!commentId) throw missing("commentId");
      if (action === "edit") {
        if (!body) throw missing("body");
        await client.comments.update({ ...scope, commentId, body });
      } else {
        await client.comments.delete({ ...scope, commentId });
      }
      return { commentId, [action === "edit" ? "edited" : "deleted"]: true };
    },
  }),
];

function missing(field: string) {
  return new ORPCError("BAD_REQUEST", { message: `${field} is required` });
}
