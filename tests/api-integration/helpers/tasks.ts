import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "../../../apps/api/src/platform/database";
import { columnsOf, createProject, setupWorkspace } from "./projects";

/** A well-formed cuid2, as the browser would generate. */
export function newTaskId() {
  return `t${randomBytes(12).toString("hex").slice(0, 23)}`;
}

const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** The n-th of an increasing run of valid fractional-index keys. */
export function positionAt(n: number) {
  return `a${DIGITS[n]}`;
}

/** A workspace with one project; columns by name, tasks added at the end of a column. */
export async function setupTasks(key = "MOR") {
  const context = await setupWorkspace();
  const project = await createProject(
    context.client,
    context.workspace.id,
    key,
  );
  const columns = await columnsOf(project.id);
  const byName = (name: string) => {
    const column = columns.find((candidate) => candidate.name === name);
    if (!column) throw new Error(`No column ${name}`);
    return column;
  };
  const used = new Map<string, number>();
  const nextPosition = (columnId: string) => {
    const n = used.get(columnId) ?? 0;
    used.set(columnId, n + 1);
    return positionAt(n);
  };
  const base = { workspaceId: context.workspace.id, projectId: project.id };

  async function addTask(
    columnName = "To Do",
    input: Partial<Parameters<typeof context.client.tasks.create>[0]> = {},
  ) {
    const column = byName(columnName);
    const id = newTaskId();
    const created = await context.client.tasks.create({
      ...base,
      id,
      columnId: column.id,
      position: nextPosition(column.id),
      title: `Task in ${columnName}`,
      ...input,
    });
    return { ...created, id };
  }

  return {
    ...context,
    projectId: project.id,
    base,
    byName,
    nextPosition,
    addTask,
  };
}

export async function taskRow(id: string) {
  const [row] = await db
    .select()
    .from(schema.taskTable)
    .where(eq(schema.taskTable.id, id));
  return row;
}

/** The transaction that last wrote a task row, as Electric would report it. */
export async function xminOfTask(id: string) {
  const rows = await db.execute<{ xmin: string }>(
    sql`SELECT xmin::text AS xmin FROM task WHERE id = ${id}`,
  );
  return Number(rows.rows[0]?.xmin);
}
