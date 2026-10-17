import { ORPCError } from "@orpc/server";
import { createId } from "@paralleldrive/cuid2";
import { generateKeyBetween } from "fractional-indexing";
import type { McpClient } from "#api/platform/orpc/mcp-tool";

/** MCP callers name things; the procedures want ids. These look them up. */

const refused = (message: string) => new ORPCError("BAD_REQUEST", { message });

const same = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

export async function resolveTask(
  client: McpClient,
  scope: { workspaceId: string; projectId: string },
  ticketId: string,
) {
  const task = await client.tasks.get({ ...scope, ticketId });
  return { ...scope, taskId: task.id };
}

export async function resolveLabelIds(
  client: McpClient,
  workspaceId: string,
  names: string[],
) {
  const labels = await client.labels.list({ workspaceId });
  return names.map((name) => {
    const label = labels.find((l) => same(l.name, name));
    if (!label) throw refused(`No label named "${name}"`);
    return label.id;
  });
}

/** Resolves an assignee given by email to a user id. */
export async function resolveAssigneeId(
  client: McpClient,
  workspaceId: string,
  email: string,
) {
  const members = await client.members.list({ workspaceId });
  const member = members.find((m) => same(m.email, email));
  if (!member) throw refused(`No member with email "${email}"`);
  return member.id;
}

/** A key at the top or bottom of a column's tasks. */
export async function taskPosition(
  client: McpClient,
  scope: { workspaceId: string; projectId: string },
  columnId: string,
  at: "top" | "bottom",
  movingTaskId?: string,
) {
  const keys = (await client.tasks.list(scope))
    .filter((t) => t.columnId === columnId && t.id !== movingTaskId)
    .map((t) => t.position)
    .sort();
  return at === "top"
    ? generateKeyBetween(null, keys[0] ?? null)
    : generateKeyBetween(keys.at(-1) ?? null, null);
}

/**
 * Label ids for names, creating the ones that do not exist yet (default
 * colour) through the labels Procedure, which checks the caller may. Returns
 * the names that were created.
 */
export async function resolveOrCreateLabelIds(
  client: McpClient,
  workspaceId: string,
  names: string[],
) {
  const labels = await client.labels.list({ workspaceId });
  const created: string[] = [];
  const ids: string[] = [];
  for (const name of names) {
    let label = labels.find((l) => same(l.name, name));
    if (!label) {
      const id = createId();
      const position = generateKeyBetween(
        labels.at(-1)?.position ?? null,
        null,
      );
      try {
        await client.labels.create({
          workspaceId,
          id,
          name,
          color: "gray",
          position,
        });
      } catch (error) {
        if (error instanceof ORPCError && error.code === "FORBIDDEN") {
          throw refused(
            `No label named "${name}", and your role may not create labels. Use an existing label.`,
          );
        }
        throw error;
      }
      label = { id, name: name.trim(), position } as (typeof labels)[number];
      labels.push(label);
      created.push(label.name);
    }
    ids.push(label.id);
  }
  return { ids, created };
}
