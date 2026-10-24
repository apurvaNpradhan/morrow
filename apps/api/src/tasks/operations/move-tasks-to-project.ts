import {
  carryFieldValues,
  compareColumns,
  comparePosition,
  type DroppedFieldValue,
  matchColumn,
  MAX_MOVE_TASKS,
  nextCompletedAt,
  type TaskEvent,
  ticketId,
} from "@morrow/sync-schemas";
import { and, eq, inArray, max, sql } from "drizzle-orm";
import { generateNKeysBetween } from "fractional-indexing";
import { recordWorkspaceActivity } from "#api/activity/index";
import type { DbOrTx } from "#api/members/index";
import { withTxid } from "#api/platform/sync/with-txid";
import {
  lockProject,
  projectColumnTable,
  projectFieldTable,
  projectTable,
} from "#api/projects/index";
import {
  rethrowTaskViolation,
  taskError,
  taskNotFound,
} from "#api/tasks/errors";
import { recordParentChange } from "#api/tasks/history/record-parent-change";
import { recordTaskEvent } from "#api/tasks/history/record-task-event";
import { refreshBlockedCounts } from "#api/tasks/lib/open-blocker-counts";
import { refreshSubtaskCounts } from "#api/tasks/lib/subtask-counts";
import { treeOrder } from "#api/tasks/lib/tree-order";
import {
  taskCommentTable,
  taskDescriptionTable,
  taskEventTable,
  taskLinkTable,
  taskTable,
  taskTicketAliasTable,
} from "#api/tasks/tables";

type Task = typeof taskTable.$inferSelect;
type Project = typeof projectTable.$inferSelect;
type Column = typeof projectColumnTable.$inferSelect;
type MovedEvent = Extract<TaskEvent, { type: "project_moved" }>["data"];

/** One moved Task, as `moveTasksToProject` reports it. */
export type MovedTask = {
  taskId: string;
  fromTicketId: string;
  toTicketId: string;
  column: string;
  droppedValues: DroppedFieldValue[];
  /** The Parent it left behind, by its old Ticket id. */
  detachedFrom: string | null;
};

/** How often a move starts over because a Task changed Project between reading and locking. */
const ATTEMPTS = 3;

/** Thrown inside the transaction when a selected Task left the Projects we locked. */
class MoveRaced extends Error {}

/**
 * Moves Tasks to another Project of the Workspace, keeping everything the
 * Workspace owns: description, comments, links, Relations, assignee and
 * history. Each Task takes the destination's next number (or its old one, when
 * it comes back) and leaves an alias for the number it had, so the old Ticket
 * id still resolves. Its Column is `columnId` for the selected Tasks when given,
 * else the one matching its own state (`matchColumn`); Field values carry over
 * where the destination has the same Field. With `withSubtasks` the whole
 * subtree moves; without it the Subtasks stay behind as top-level Tasks. A
 * moved Task whose Parent stays leaves it.
 *
 * Every source Project and the destination are locked in id order, and
 * everything is read and written under those locks. All or nothing: more
 * than `MAX_MOVE_TASKS` Tasks, a Task already in the destination, an archived
 * Project or a Column of another Project refuse the whole move.
 */
export async function moveTasksToProject(
  workspaceId: string,
  toProjectId: string,
  taskIds: string[],
  options: { columnId?: string; withSubtasks: boolean },
) {
  for (let attempt = 1; ; attempt++) {
    try {
      const { result, txid } = await withTxid((tx) =>
        move(tx, workspaceId, toProjectId, [...new Set(taskIds)], options),
      );
      return { moved: result, txid };
    } catch (error) {
      if (error instanceof MoveRaced && attempt < ATTEMPTS) continue;
      if (error instanceof MoveRaced) throw taskNotFound();
      rethrowTaskViolation(error);
    }
  }
}

async function move(
  tx: DbOrTx,
  workspaceId: string,
  toProjectId: string,
  selectedIds: string[],
  { columnId, withSubtasks }: { columnId?: string; withSubtasks: boolean },
) {
  // The Projects to lock come from a first, unlocked read.
  const located = await tx
    .select({ id: taskTable.id, projectId: taskTable.projectId })
    .from(taskTable)
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .where(
      and(
        inArray(taskTable.id, selectedIds),
        eq(projectTable.workspaceId, workspaceId),
      ),
    );
  if (located.length !== selectedIds.length) throw taskNotFound();
  const lockIds = [
    ...new Set([toProjectId, ...located.map((task) => task.projectId)]),
  ].sort();
  const projects = new Map<string, Project>();
  for (const id of lockIds) {
    projects.set(id, await lockProject(tx, workspaceId, id));
  }
  const to = projects.get(toProjectId)!;

  // Everything below is read under the locks.
  const selected = await tx
    .select()
    .from(taskTable)
    .where(inArray(taskTable.id, selectedIds));
  if (selected.length !== selectedIds.length) throw taskNotFound();
  for (const task of selected) {
    if (!projects.has(task.projectId)) throw new MoveRaced();
    if (task.projectId === toProjectId) throw taskError("MOVE_SAME_PROJECT");
  }

  const tasks = withSubtasks
    ? await withDescendants(tx, selectedIds)
    : selected;
  if (tasks.length > MAX_MOVE_TASKS) {
    throw taskError("MOVE_TOO_LARGE", { count: tasks.length });
  }
  const moving = new Set(tasks.map((task) => task.id));
  const selectedSet = new Set(selectedIds);

  const columns = await tx
    .select()
    .from(projectColumnTable)
    .where(inArray(projectColumnTable.projectId, lockIds));
  const columnById = new Map(columns.map((column) => [column.id, column]));
  const toColumns = columns
    .filter((column) => column.projectId === toProjectId)
    .sort(compareColumns);
  const chosen = columnId
    ? toColumns.find((column) => column.id === columnId)
    : undefined;
  if (columnId && !chosen) throw taskError("COLUMN_NOT_IN_PROJECT");

  const fields = await tx
    .select()
    .from(projectFieldTable)
    .where(inArray(projectFieldTable.projectId, lockIds));
  const fieldsOf = (projectId: string) =>
    fields.filter((field) => field.projectId === projectId);

  // Parents the move separates from their Subtasks, to fix counters and history.
  const parentIds = [
    ...new Set(
      tasks.flatMap((task) =>
        task.parentId && !moving.has(task.parentId) ? [task.parentId] : [],
      ),
    ),
  ];
  const leftBehind = new Map(
    (parentIds.length === 0
      ? []
      : await tx
          .select()
          .from(taskTable)
          .where(inArray(taskTable.id, parentIds))
    ).map((parent) => [parent.id, parent]),
  );
  const detached = new Map<string, Task>();
  for (const task of tasks) {
    const parent = task.parentId ? leftBehind.get(task.parentId) : undefined;
    if (parent) detached.set(task.id, parent);
  }
  // Subtasks that stay behind when their Parent moves alone.
  const orphans = withSubtasks
    ? []
    : await tx
        .select()
        .from(taskTable)
        .where(
          and(
            inArray(taskTable.parentId, [...moving]),
            sql`${taskTable.id} NOT IN (${sql.join([...moving], sql`, `)})`,
          ),
        );

  // History of a separation is written while everyone is still in the source
  // Project and still has the old number.
  for (const [childId, parent] of detached) {
    const child = tasks.find((task) => task.id === childId)!;
    await recordParentChange(
      tx,
      projects.get(child.projectId)!,
      child,
      parent,
      null,
    );
  }
  const movingTasks = new Map(tasks.map((task) => [task.id, task]));
  for (const orphan of orphans) {
    const parent = movingTasks.get(orphan.parentId!)!;
    await recordParentChange(
      tx,
      projects.get(orphan.projectId)!,
      orphan,
      parent,
      null,
    );
  }
  if (orphans.length > 0) {
    await tx
      .update(taskTable)
      .set({ parentId: null })
      .where(
        inArray(
          taskTable.id,
          orphans.map((orphan) => orphan.id),
        ),
      );
  }

  // Numbers, parent first: a returning Task takes its old one back.
  // Source Projects rank by when the caller first named one of their Tasks.
  const sourceOf = new Map(selected.map((task) => [task.id, task.projectId]));
  const projectRank = new Map<string, number>();
  for (const id of selectedIds) {
    const projectId = sourceOf.get(id)!;
    if (!projectRank.has(projectId))
      projectRank.set(projectId, projectRank.size);
  }
  // Roots take numbers in the order the caller named them.
  const pickedAt = new Map(selectedIds.map((id, index) => [id, index]));
  const ordered = treeOrder(tasks, (task) => pickedAt.get(task.id) ?? 0);
  const returning = new Map(
    (
      await tx
        .select()
        .from(taskTicketAliasTable)
        .where(
          and(
            eq(taskTicketAliasTable.projectId, toProjectId),
            inArray(taskTicketAliasTable.taskId, [...moving]),
          ),
        )
    ).map((alias) => [alias.taskId, alias.number]),
  );
  let counter = to.lastTaskNumber;
  const numberOf = new Map<string, number>();
  for (const task of ordered) {
    numberOf.set(task.id, returning.get(task.id) ?? ++counter);
  }

  // Columns, then positions: appended after what each Column holds, archived
  // Tasks included, in the order the Tasks had on their boards.
  const targetOf = new Map<string, Column>();
  for (const task of tasks) {
    const from = columnById.get(task.columnId)!;
    targetOf.set(
      task.id,
      (selectedSet.has(task.id) ? chosen : undefined) ??
        matchColumn(
          toColumns,
          { column: from.name, category: from.category },
          [],
        ).column,
    );
  }
  const boardOrder = (a: Task, b: Task) =>
    projectRank.get(a.projectId)! - projectRank.get(b.projectId)! ||
    compareColumns(columnById.get(a.columnId)!, columnById.get(b.columnId)!) ||
    comparePosition(a, b);
  const positionOf = new Map<string, string>();
  for (const column of new Set(targetOf.values())) {
    const inColumn = tasks
      .filter((task) => targetOf.get(task.id) === column)
      .sort(boardOrder);
    const [last] = await tx
      .select({ position: max(taskTable.position) })
      .from(taskTable)
      .where(eq(taskTable.columnId, column.id));
    const keys = generateNKeysBetween(
      last?.position ?? null,
      null,
      inColumn.length,
    );
    for (const [at, task] of inColumn.entries()) {
      positionOf.set(task.id, keys[at]!);
    }
  }

  // Write: aliases first for the numbers left, the returning ones are freed.
  if (returning.size > 0) {
    await tx
      .delete(taskTicketAliasTable)
      .where(
        and(
          eq(taskTicketAliasTable.projectId, toProjectId),
          inArray(taskTicketAliasTable.taskId, [...returning.keys()]),
        ),
      );
  }
  await tx.insert(taskTicketAliasTable).values(
    tasks.map((task) => ({
      projectId: task.projectId,
      number: task.number,
      taskId: task.id,
    })),
  );
  await tx
    .update(projectTable)
    .set({ lastTaskNumber: counter })
    .where(eq(projectTable.id, toProjectId));

  const now = new Date();
  const results: MovedTask[] = [];
  const story = new Map<string, MovedEvent>();
  for (const task of ordered) {
    const from = projects.get(task.projectId)!;
    const fromColumn = columnById.get(task.columnId)!;
    const toColumn = targetOf.get(task.id)!;
    const carried = carryFieldValues(
      fieldsOf(task.projectId),
      fieldsOf(toProjectId),
      task.fieldValues,
    );
    const number = numberOf.get(task.id)!;
    await tx
      .update(taskTable)
      .set({
        projectId: toProjectId,
        number,
        columnId: toColumn.id,
        position: positionOf.get(task.id)!,
        parentId: detached.has(task.id) ? null : task.parentId,
        fieldValues: carried.values,
        completedAt: nextCompletedAt(
          task.completedAt,
          fromColumn.category,
          toColumn.category,
          now,
        ),
      })
      .where(eq(taskTable.id, task.id));
    const detachedFrom = detached.get(task.id);
    results.push({
      taskId: task.id,
      fromTicketId: ticketId(from.key, task.number),
      toTicketId: ticketId(to.key, number),
      column: toColumn.name,
      droppedValues: carried.dropped,
      detachedFrom: detachedFrom
        ? ticketId(from.key, detachedFrom.number)
        : null,
    });
    story.set(task.id, {
      from: {
        projectId: from.id,
        key: from.key,
        name: from.name,
        ticketId: ticketId(from.key, task.number),
        column: columnRef(fromColumn),
      },
      to: {
        projectId: to.id,
        key: to.key,
        name: to.name,
        ticketId: ticketId(to.key, number),
        column: columnRef(toColumn),
      },
      droppedValues: carried.dropped,
    });
  }

  // The rows that repeat `project_id` for shape scoping follow their Task.
  const ids = [...moving];
  for (const table of [
    taskDescriptionTable,
    taskCommentTable,
    taskLinkTable,
    taskEventTable,
  ]) {
    await tx
      .update(table)
      .set({ projectId: toProjectId })
      .where(inArray(table.taskId, ids));
  }

  for (const [taskId, data] of story) {
    await recordTaskEvent(tx, toProjectId, taskId, {
      type: "project_moved",
      data,
    });
  }
  for (const result of results) {
    const task = movingTasks.get(result.taskId)!;
    await recordWorkspaceActivity(
      {
        type: "task.moved",
        workspaceId,
        projectId: toProjectId,
        taskId: task.id,
        ticketId: result.toTicketId,
        taskTitle: task.title,
        fromTicketId: result.fromTicketId,
        fromProjectName: projects.get(task.projectId)!.name,
        toProjectName: to.name,
      },
      tx,
    );
  }

  // Counters are recomputed from rows, on every Parent a move touched.
  await refreshSubtaskCounts(tx, [...leftBehind.keys(), ...ids]);
  await refreshBlockedCounts(tx, ids);
  return results;
}

const columnRef = ({ id, name, category }: Column) => ({ id, name, category });

/** The selected Tasks and everything under them, deduplicated. */
async function withDescendants(tx: DbOrTx, rootIds: string[]) {
  const found = await tx.execute<{ id: string }>(sql`
    WITH RECURSIVE tree(id) AS (
      SELECT id FROM task WHERE id IN (${sql.join(rootIds, sql`, `)})
      UNION
      SELECT t.id FROM task t JOIN tree ON t.parent_id = tree.id
    )
    SELECT id FROM tree`);
  const ids = found.rows.map((row) => row.id);
  // Over the cap the rows are never loaded.
  if (ids.length > MAX_MOVE_TASKS) {
    throw taskError("MOVE_TOO_LARGE", { count: ids.length });
  }
  return tx.select().from(taskTable).where(inArray(taskTable.id, ids));
}
