import { ORPCError } from "@orpc/server";
import { createId } from "@paralleldrive/cuid2";
import { generateKeyBetween } from "fractional-indexing";
import {
  COLUMN_COLOR_BY_NAME,
  type NamedFieldValue,
  unnameFieldValue,
} from "@morrow/sync-schemas";
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
    // A moved task answers to its old ticket id but lives in another project.
    return { ...scope, projectId: task.projectId, taskId: task.id };
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
 * Field ids and stored values for Fields given by name (any letter case) and
 * values given the way people write them: option names, a number, a
 * YYYY-MM-DD date, a boolean for a checkbox. `null` stays `null`, which clears
 * a value. An unknown field or option, or a value of the wrong kind, is refused
 * with what exists.
 */
export async function resolveFieldValues(
  client: McpClient,
  scope: { workspaceId: string; projectId: string },
  named: Record<string, NamedFieldValue | null>,
) {
  const fields = await client.projects.fields.list(scope);
  return Object.entries(named).map(([fieldName, given]) => {
    const field = fields.find((f) => same(f.name, fieldName));
    if (!field) {
      throw refused(
        `No field named "${fieldName}". Fields: ${fields.map((f) => f.name).join(", ") || "none"}`,
      );
    }
    const options = field.options.map((o) => ({ ...o, position: "" }));
    const result = unnameFieldValue({ ...field, options }, given);
    if (!result.ok) {
      throw refused(
        result.unknownOption !== undefined
          ? `No option "${result.unknownOption}" in field "${field.name}". Options: ${field.options.map((o) => o.name).join(", ")}`
          : `Invalid value for ${FIELD_TYPE_LABEL[field.type]} field "${field.name}".`,
      );
    }
    return { fieldId: field.id, value: result.value };
  });
}

const FIELD_TYPE_LABEL = {
  single_choice: "single choice",
  multi_choice: "multi choice",
  text: "text",
  number: "number",
  date: "date (YYYY-MM-DD)",
  checkbox: "checkbox (true or false)",
} as const;

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
