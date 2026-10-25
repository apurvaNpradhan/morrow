import {
  nextOccurrence,
  parseRecurrence,
  rebaseRecurrence,
  recurrenceText,
  taskDateDay,
  ticketId,
} from "@morrow/sync-schemas";
import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq, inArray, isNull, min, max, sql } from "drizzle-orm";
import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing";
import type { DbOrTx } from "#api/members/index";
import { eventContext } from "#api/platform/event-context";
import { schema } from "#api/platform/database/index";
import { projectColumnTable, projectTable } from "#api/projects/index";
import { recordParentChange } from "#api/tasks/history/record-parent-change";
import { recordTaskEvent } from "#api/tasks/history/record-task-event";
import { saveDescription } from "#api/tasks/lib/description";
import { dueOf, zoneOfUser } from "#api/tasks/lib/recurrence";
import { recordTaskActivity } from "#api/tasks/lib/record-task-activity";
import { refreshSubtaskCounts } from "#api/tasks/lib/subtask-counts";
import { taskDescriptionTable, taskTable } from "#api/tasks/tables";

type Task = typeof taskTable.$inferSelect;

/**
 * Whether a write that put a task in a Column just completed it into `done`:
 * it was open and now carries a completion. Canceling and moving between
 * closed Columns do not repeat anything.
 */
export function completedIntoDone(
  before: Date | null,
  after: Date | null,
  category: string,
) {
  return before === null && after !== null && category === "done";
}

/**
 * Takes the repeat rule off a task, which ends its series: nothing else
 * carries it. Does nothing for a task without one.
 */
export async function endRecurrence(
  tx: DbOrTx,
  projectId: string,
  taskId: string,
) {
  const [task] = await tx
    .select({ recurrence: taskTable.recurrence })
    .from(taskTable)
    .where(eq(taskTable.id, taskId));
  if (!task?.recurrence) return;
  await tx
    .update(taskTable)
    .set({ recurrence: null, updatedAt: new Date() })
    .where(eq(taskTable.id, taskId));
  await recordTaskEvent(tx, projectId, taskId, {
    type: "recurrence",
    data: { from: task.recurrence, to: null },
  });
}

/**
 * What a write that put a task in a Column does to its repeat rule, called
 * once the task's row is final: completing it into `done` spawns the next
 * occurrence, canceling it ends the series.
 */
export async function settleRecurrence(
  tx: DbOrTx,
  scope: { workspaceId: string; project: { id: string; key: string } },
  taskId: string,
  change: { before: Date | null; after: Date | null; category: string },
  now = new Date(),
) {
  if (completedIntoDone(change.before, change.after, change.category)) {
    await spawnNextOccurrence(tx, scope, taskId, now);
  } else if (change.category === "canceled") {
    await endRecurrence(tx, scope.project.id, taskId);
  }
}

/**
 * Called inside the write that completed `taskId` into a `done` Column, after
 * the task's row is final. A task with a rule gets its next occurrence: a new
 * Task at the top of the Project's first `unstarted` Column, with the next due
 * date, the same title, description, priority, assignee (if still a Member),
 * labels and Field values, every subtask recreated open, and the rule moved to
 * it. The completed Task keeps comments, attachments and relations. When the
 * series has ended nothing is created. Either way the old Task loses the rule.
 */
export async function spawnNextOccurrence(
  tx: DbOrTx,
  scope: { workspaceId: string; project: { id: string; key: string } },
  taskId: string,
  now = new Date(),
) {
  const { workspaceId, project } = scope;
  const [task] = await tx
    .select()
    .from(taskTable)
    .where(eq(taskTable.id, taskId));
  if (!task?.recurrence) return;
  const due = dueOf(task);
  const parsed = due ? parseRecurrence(task.recurrence, due) : null;
  const ended = async () => {
    await tx
      .update(taskTable)
      .set({ recurrence: null, updatedAt: now })
      .where(eq(taskTable.id, taskId));
    await recordTaskEvent(tx, project.id, taskId, {
      type: "recurrence",
      data: { from: task.recurrence, to: null },
    });
  };
  if (!due || !parsed?.ok) return ended();

  const actorId = eventContext.getStore()?.actorUserId ?? null;
  const actorZone = await zoneOfUser(tx, actorId);
  const { recurrence } = parsed;
  const today = taskDateDay(now, true, recurrence.zone ?? actorZone);
  const next = nextOccurrence(recurrence, due, today);
  if (next === null) return ended();

  const [column] = await tx
    .select({ id: projectColumnTable.id })
    .from(projectColumnTable)
    .where(
      and(
        eq(projectColumnTable.projectId, project.id),
        eq(projectColumnTable.category, "unstarted"),
      ),
    )
    .orderBy(asc(projectColumnTable.position))
    .limit(1);
  if (!column) return ended();

  // Who may keep their assignment: those still in the Workspace.
  const members = new Set(
    (
      await tx
        .select({ userId: schema.workspaceUserTable.userId })
        .from(schema.workspaceUserTable)
        .where(eq(schema.workspaceUserTable.workspaceId, workspaceId))
    ).map((member) => member.userId),
  );
  const assignee = (id: string | null) => (id && members.has(id) ? id : null);

  // The task's subtasks, and theirs, that are still around.
  const family: Task[] = [];
  let level = [task.id];
  while (level.length > 0) {
    const children = await tx
      .select()
      .from(taskTable)
      .where(
        and(inArray(taskTable.parentId, level), isNull(taskTable.archivedAt)),
      )
      .orderBy(asc(taskTable.number));
    family.push(...children);
    level = children.map((child) => child.id);
  }

  const [counter] = await tx
    .update(projectTable)
    .set({
      lastTaskNumber: sql`${projectTable.lastTaskNumber} + ${family.length + 1}`,
    })
    .where(eq(projectTable.id, project.id))
    .returning({ last: projectTable.lastTaskNumber });
  if (!counter) throw new Error("Project counter returned no row");
  const firstNumber = counter.last - family.length;

  const [top] = await tx
    .select({ position: min(taskTable.position) })
    .from(taskTable)
    .where(eq(taskTable.columnId, column.id));
  const topPosition = generateKeyBetween(null, top?.position ?? null);

  // The start date keeps its distance before the due date.
  const gap =
    task.startAt && task.dueAt
      ? task.dueAt.getTime() - task.startAt.getTime()
      : null;
  const startAt = gap === null ? null : new Date(next.at.getTime() - gap);
  const rule = recurrenceText(rebaseRecurrence(recurrence, next, actorZone));

  const newId = createId();
  const [created] = await tx
    .insert(taskTable)
    .values({
      id: newId,
      projectId: project.id,
      columnId: column.id,
      number: firstNumber,
      title: task.title,
      priority: task.priority,
      assigneeId: assignee(task.assigneeId),
      startAt: startAt && !task.startHasTime ? dayStart(startAt) : startAt,
      startHasTime: startAt !== null && task.startHasTime,
      dueAt: next.at,
      dueHasTime: next.hasTime,
      recurrence: rule,
      labelIds: task.labelIds,
      fieldValues: task.fieldValues,
      position: topPosition,
      createdBy: actorId ?? task.createdBy,
    })
    .returning({
      id: taskTable.id,
      number: taskTable.number,
      title: taskTable.title,
    });
  if (!created) throw new Error("Task insert returned no row");

  const descriptionOf = async (id: string) => {
    const [row] = await tx
      .select({ description: taskDescriptionTable.description })
      .from(taskDescriptionTable)
      .where(eq(taskDescriptionTable.taskId, id));
    return row?.description ?? "";
  };
  const owner = actorId ?? task.createdBy;
  /** The description of a copy: its files are claimed for the copy by `owner`, when there is one. */
  const copyDescription = async (from: string, to: string) => {
    const description = await descriptionOf(from);
    if (owner === null) {
      await tx
        .insert(taskDescriptionTable)
        .values({ taskId: to, projectId: project.id, description });
      return;
    }
    await saveDescription(
      tx,
      { workspaceId, projectId: project.id, taskId: to, userId: owner },
      description,
    );
  };
  await copyDescription(task.id, newId);
  await recordTaskActivity(tx, "task.created", workspaceId, project, created);
  await recordTaskEvent(tx, project.id, newId, { type: "created", data: {} });

  // Subtasks come back open, after what the Column holds.
  const copies = new Map<string, { id: string; number: number }>([
    [task.id, { id: newId, number: created.number }],
  ]);
  if (family.length > 0) {
    const [last] = await tx
      .select({ position: max(taskTable.position) })
      .from(taskTable)
      .where(eq(taskTable.columnId, column.id));
    const positions = generateNKeysBetween(
      last?.position ?? null,
      null,
      family.length,
    );
    for (const [index, child] of family.entries()) {
      const id = createId();
      const parent = copies.get(child.parentId!)!;
      const number = firstNumber + 1 + index;
      await tx.insert(taskTable).values({
        id,
        projectId: project.id,
        parentId: parent.id,
        columnId: column.id,
        number,
        title: child.title,
        priority: child.priority,
        assigneeId: assignee(child.assigneeId),
        labelIds: child.labelIds,
        fieldValues: child.fieldValues,
        position: positions[index]!,
        createdBy: owner,
      });
      copies.set(child.id, { id, number });
      await copyDescription(child.id, id);
      const copy = { id, number, title: child.title };
      await recordTaskActivity(tx, "task.created", workspaceId, project, copy);
      await recordTaskEvent(tx, project.id, id, { type: "created", data: {} });
      await recordParentChange(tx, project, copy, null, parent);
    }
    await refreshSubtaskCounts(
      tx,
      [...copies.values()].map((copy) => copy.id),
    );
  }

  await tx
    .update(taskTable)
    .set({ recurrence: null, updatedAt: now })
    .where(eq(taskTable.id, taskId));
  await recordTaskEvent(tx, project.id, taskId, {
    type: "recurred",
    data: { direction: "to", ticketId: ticketId(project.key, created.number) },
  });
  await recordTaskEvent(tx, project.id, newId, {
    type: "recurred",
    data: { direction: "from", ticketId: ticketId(project.key, task.number) },
  });
}

/** 00:00 UTC of the UTC day `at` falls on: a day, as the database holds one. */
function dayStart(at: Date) {
  return new Date(
    Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()),
  );
}
