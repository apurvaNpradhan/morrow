import { ORPCError } from "@orpc/server";
import { createId } from "@paralleldrive/cuid2";
import { RELATION_TYPES } from "@morrow/sync-schemas";
import { z } from "zod";
import { mcpTool } from "#api/platform/orpc/mcp-tool";
import { resolveTask } from "#api/tasks/mcp-resolve";

const ticket = z.string().trim().min(1);

export const relationsMcpTools = [
  mcpTool({
    name: "manage_relation",
    description:
      'Add or remove a relation between two tasks of a workspace, which may be in different projects. type blocks: ticketId blocks otherTicketId (which then reads "blocked by"). type duplicate: ticketId is a duplicate of otherTicketId (which reads "duplicated by"). type related: the pair is the same whichever you name first. Adding a pair that is already linked, a task to itself, or a loop of blocks is refused with a code. Removing names the same pair and type. get_task lists a task\'s relations.',
    inputSchema: z.object({
      workspaceId: z.string().trim().min(1),
      action: z.enum(["add", "remove"]),
      type: z.enum(RELATION_TYPES),
      ticketId: ticket.describe("For example MOR-12."),
      otherTicketId: ticket.describe("For example API-3; any project."),
    }),
    run: async (
      { workspaceId, action, type, ticketId, otherTicketId },
      client,
    ) => {
      const source = await resolveEnd(client, workspaceId, ticketId);
      const target = await resolveEnd(client, workspaceId, otherTicketId);
      if (action === "add") {
        await client.relations.add({
          workspaceId,
          id: createId(),
          type,
          sourceTaskId: source.taskId,
          targetTaskId: target.taskId,
        });
        return { type, ticketId, otherTicketId, added: true };
      }
      const { relations } = source;
      const found = relations.find(
        (relation) =>
          relation.type === type &&
          relation.ticketId.toUpperCase() === otherTicketId.toUpperCase() &&
          (type === "related" || relation.direction === "outgoing"),
      );
      if (!found) {
        throw new ORPCError("NOT_FOUND", {
          message: `${ticketId} has no ${type} relation with ${otherTicketId}`,
        });
      }
      await client.relations.delete({ workspaceId, relationId: found.id });
      return { type, ticketId, otherTicketId, removed: true };
    },
  }),
];

/** A task by ticket id, wherever in the workspace it is, with its relations. */
async function resolveEnd(
  client: Parameters<typeof resolveTask>[0],
  workspaceId: string,
  ticketId: string,
) {
  const key = /^([A-Za-z0-9]{2,6})-\d+$/.exec(ticketId)?.[1]?.toUpperCase();
  const projects = await client.projects.list({ workspaceId });
  const project = projects.find((p) => p.key.toUpperCase() === key);
  if (!project) {
    throw new ORPCError("NOT_FOUND", {
      message: `No project for ticket id "${ticketId}"`,
    });
  }
  const scope = await resolveTask(
    client,
    { workspaceId, projectId: project.id },
    ticketId,
  );
  const task = await client.tasks.get({ ...scope, ticketId });
  return { taskId: scope.taskId, relations: task.relations };
}
