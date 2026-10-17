import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";
import { ORPCError } from "@orpc/server";
import { generateKeyBetween } from "fractional-indexing";
import { mcpTool } from "#api/platform/orpc/mcp-tool";
import { labelColor, labelName } from "./schemas";

export const labelsMcpTools = [
  mcpTool({
    name: "list_labels",
    description:
      "List the labels of a workspace in their order, with name and colour. Tasks carry these labels.",
    inputSchema: z.object({ workspaceId: z.string().trim().min(1) }),
    run: async (input, client) =>
      (await client.labels.list(input)).map(({ name, color }) => ({
        name,
        color,
      })),
  }),
  mcpTool({
    name: "manage_label",
    description:
      "Create, update or delete a workspace label. create takes name and color. update takes label (its name) with a new name and/or color. delete takes label.",
    inputSchema: z.object({
      workspaceId: z.string().trim().min(1),
      action: z.enum(["create", "update", "delete"]),
      label: z.string().optional(),
      name: labelName.optional(),
      color: labelColor.optional(),
    }),
    run: async ({ workspaceId, action, label, name, color }, client) => {
      const labels = await client.labels.list({ workspaceId });
      if (action === "create") {
        if (!name || !color) throw missing("name and color");
        const id = createId();
        await client.labels.create({
          workspaceId,
          id,
          name,
          color,
          position: generateKeyBetween(labels.at(-1)?.position ?? null, null),
        });
        return { labelId: id };
      }
      if (!label) throw missing("label");
      const found = labels.find(
        (l) => l.name.toLowerCase() === label.trim().toLowerCase(),
      );
      if (!found) throw missing(`an existing label named "${label}"`);
      if (action === "update") {
        await client.labels.update({
          workspaceId,
          labelId: found.id,
          name,
          color,
        });
        return { labelId: found.id, updated: true };
      }
      await client.labels.delete({ workspaceId, labelId: found.id });
      return { labelId: found.id, deleted: true };
    },
  }),
];

function missing(what: string) {
  return new ORPCError("BAD_REQUEST", { message: `${what} required` });
}
