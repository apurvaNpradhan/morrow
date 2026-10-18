import { ORPCError } from "@orpc/server";
import { createId } from "@paralleldrive/cuid2";
import { z } from "zod";
import { mcpTool } from "#api/platform/orpc/mcp-tool";
import { resolveTask } from "#api/tasks/mcp-resolve";
import { linkTitle, linkUrl } from "#api/tasks/schemas";

const task = {
  workspaceId: z.string().trim().min(1),
  projectId: z.string().trim().min(1),
  ticketId: z.string().trim().min(1),
};

export const linksMcpTools = [
  mcpTool({
    name: "manage_link",
    description:
      "Create, update or delete an external link (pull request, design, doc) on a task. Update and delete take a linkId from get_task. Creating a URL the task already has returns the existing link. Only http and https URLs.",
    inputSchema: z.object({
      ...task,
      action: z.enum(["create", "update", "delete"]),
      linkId: z.string().optional(),
      url: linkUrl.optional(),
      title: linkTitle.optional(),
    }),
    run: async ({ action, linkId, url, title, ...input }, client) => {
      const scope = await resolveTask(client, input, input.ticketId);
      if (action === "create") {
        if (!url) throw missing("url");
        const link = await client.links.add({
          ...scope,
          id: createId(),
          url,
          title: title === null ? "" : title,
        });
        return { linkId: link.id, url, title: title ?? null };
      }
      if (!linkId) throw missing("linkId");
      if (action === "update") {
        await client.links.update({
          ...scope,
          linkId,
          url,
          title: title === null ? "" : title,
        });
        return {
          linkId,
          ...(url !== undefined && { url }),
          ...(title !== undefined && { title }),
        };
      }
      await client.links.delete({ ...scope, linkId });
      return { linkId, deleted: true };
    },
  }),
];

function missing(field: string) {
  return new ORPCError("BAD_REQUEST", { message: `${field} is required` });
}
