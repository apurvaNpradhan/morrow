import { ORPCError } from "@orpc/server";
import { createId } from "@paralleldrive/cuid2";
import { generateKeyBetween } from "fractional-indexing";
import { COLUMN_COLOR_BY_NAME } from "@morrow/sync-schemas";
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
  try {
    const task = await client.tasks.get({ ...scope, ticketId });
    return { ...scope, taskId: task.id };
  } catch (error) {
    if (error instanceof ORPCError && error.code === "NOT_FOUND") {
      throw new ORPCError("NOT_FOUND", {
        message: `No task ${ticketId} in this project`,
      });
    }
    throw error;
  }
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

/**
 * Keys for putting tasks at the top or bottom of a column. The project's
 * tasks are read once, on first use, and each key handed out is remembered, so
 * a batch of 50 creates reads them once and its items line up in order.
 */
export function taskPositions(
  client: McpClient,
  scope: { workspaceId: string; projectId: string },
  movingTaskId?: string,
) {
  let byColumn: Map<string, string[]> | undefined;
  return async (columnId: string, at: "top" | "bottom") => {
    if (!byColumn) {
      byColumn = new Map();
      for (const task of await client.tasks.list(scope)) {
        if (task.id === movingTaskId) continue;
        byColumn.set(task.columnId, [
          ...(byColumn.get(task.columnId) ?? []),
          task.position,
        ]);
      }
      for (const keys of byColumn.values()) keys.sort();
    }
    const keys = byColumn.get(columnId) ?? [];
    byColumn.set(columnId, keys);
    if (at === "top") {
      const key = generateKeyBetween(null, keys[0] ?? null);
      keys.unshift(key);
      return key;
    }
    const key = generateKeyBetween(keys.at(-1) ?? null, null);
    keys.push(key);
    return key;
  };
}

/**
 * Field ids and option ids for Fields and options given by name (any letter
 * case); `null` stays `null`, which clears a value. An unknown name is refused
 * with the names that exist.
 */
export async function resolveFieldValues(
  client: McpClient,
  scope: { workspaceId: string; projectId: string },
  named: Record<string, string | null>,
) {
  const fields = await client.projects.fields.list(scope);
  return Object.entries(named).map(([fieldName, optionName]) => {
    const field = fields.find((f) => same(f.name, fieldName));
    if (!field) {
      throw refused(
        `No field named "${fieldName}". Fields: ${fields.map((f) => f.name).join(", ") || "none"}`,
      );
    }
    if (optionName === null) return { fieldId: field.id, value: null };
    const option = field.options.find((o) => same(o.name, optionName));
    if (!option) {
      throw refused(
        `No option "${optionName}" in field "${field.name}". Options: ${field.options.map((o) => o.name).join(", ")}`,
      );
    }
    return { fieldId: field.id, value: option.id };
  });
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
          color: COLUMN_COLOR_BY_NAME.gray,
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
