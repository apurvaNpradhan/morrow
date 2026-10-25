import { formatTaskDate, type TaskRow } from "@morrow/sync-schemas";
import { rpc } from "@/app/lib/orpc";
import { projectCollection } from "@/projects";
import { sameFieldValue } from "../lib/field-value";

type TaskMutation = { original: TaskRow; changes: Partial<TaskRow> };

/** The workspace a task's project belongs to; every task write names it. */
export function workspaceOf(projectId: string) {
  const project = projectCollection.get(projectId);
  if (!project) throw new Error("Project is not loaded");
  return project.workspaceId;
}

/**
 * Sends one local edit to the server, one Procedure per field group it
 * touched, and returns the transaction ids to wait for. Each Procedure writes
 * only its own fields, so an edit never overwrites someone else's change to
 * another field of the same task.
 */
export async function writeTaskChanges({ original, changes }: TaskMutation) {
  const target = {
    workspaceId: workspaceOf(original.projectId),
    projectId: original.projectId,
    taskId: original.id,
  };
  const txids: number[] = [];
  const keep = async (call: Promise<{ txid: number | null }>) => {
    const { txid } = await call;
    if (txid !== null) txids.push(txid);
  };

  if (changes.title !== undefined) {
    await keep(rpc.tasks.updateTitle({ ...target, title: changes.title }));
  }
  if (changes.priority !== undefined) {
    await keep(
      rpc.tasks.updatePriority({ ...target, priority: changes.priority }),
    );
  }
  // Before the due date: a start the due date takes along is cleared first.
  if (changes.startAt !== undefined || changes.startHasTime !== undefined) {
    const startAt =
      changes.startAt === undefined ? original.startAt : changes.startAt;
    const startHasTime = changes.startHasTime ?? original.startHasTime;
    await keep(
      rpc.tasks.updateStartDate({
        ...target,
        startDate: formatTaskDate(startAt, startHasTime),
      }),
    );
  }
  if (changes.dueAt !== undefined || changes.dueHasTime !== undefined) {
    const dueAt = changes.dueAt === undefined ? original.dueAt : changes.dueAt;
    const dueHasTime = changes.dueHasTime ?? original.dueHasTime;
    await keep(
      rpc.tasks.updateDueDate({
        ...target,
        dueDate: formatTaskDate(dueAt, dueHasTime),
      }),
    );
  }
  if (changes.recurrence !== undefined) {
    await keep(
      rpc.tasks.updateRecurrence({
        ...target,
        recurrence: changes.recurrence,
      }),
    );
  }
  if (changes.assigneeId !== undefined) {
    await keep(
      rpc.tasks.updateAssignee({ ...target, assigneeId: changes.assigneeId }),
    );
  }
  if (changes.parentId !== undefined) {
    await keep(
      rpc.tasks.updateParent({ ...target, parentId: changes.parentId }),
    );
  }
  if (changes.labelIds !== undefined) {
    // Adding and removing are separate writes, so two people labelling one
    // task at once both land.
    const now = new Set(changes.labelIds);
    const before = new Set(original.labelIds);
    for (const labelId of changes.labelIds) {
      if (!before.has(labelId)) {
        await keep(rpc.tasks.addLabel({ ...target, labelId }));
      }
    }
    for (const labelId of original.labelIds) {
      if (!now.has(labelId)) {
        await keep(rpc.tasks.removeLabel({ ...target, labelId }));
      }
    }
  }
  if (changes.fieldValues !== undefined) {
    // One write per Field that differs, so two people setting different Fields
    // of one task both land.
    const now = changes.fieldValues;
    const before = original.fieldValues;
    for (const [fieldId, value] of Object.entries(now)) {
      if (!sameFieldValue(before[fieldId], value)) {
        await keep(rpc.tasks.setFieldValue({ ...target, fieldId, value }));
      }
    }
    for (const fieldId of Object.keys(before)) {
      if (!(fieldId in now)) {
        await keep(
          rpc.tasks.setFieldValue({ ...target, fieldId, value: null }),
        );
      }
    }
  }
  if (changes.columnId !== undefined || changes.position !== undefined) {
    await keep(
      rpc.tasks.move({
        ...target,
        columnId: changes.columnId ?? original.columnId,
        position: changes.position ?? original.position,
      }),
    );
  }
  if (changes.archivedAt !== undefined) {
    await keep(
      changes.archivedAt
        ? rpc.tasks.archive(target)
        : rpc.tasks.unarchive(target),
    );
  }
  return txids;
}
