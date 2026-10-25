import {
  describeRecurrence,
  nextOccurrence,
  parseRecurrence,
  type TaskDate,
} from "@morrow/sync-schemas";

type Repeating = {
  recurrence: string | null;
  dueAt: Date | null;
  dueHasTime: boolean;
};

const parsed = new Map<string, ReturnType<typeof parseRecurrence>>();

/** A task's rule, read against its due date; a list shows this for every repeating row, so it is remembered. */
function read(task: Repeating) {
  if (!task.recurrence || !task.dueAt) return null;
  const key = `${task.dueAt.getTime()}|${task.dueHasTime}|${task.recurrence}`;
  let result = parsed.get(key);
  if (!result) {
    result = parseRecurrence(task.recurrence, {
      at: task.dueAt,
      hasTime: task.dueHasTime,
    });
    if (parsed.size > 500) parsed.clear();
    parsed.set(key, result);
  }
  return result.ok ? result.recurrence : null;
}

/** "every week on Monday", or null when the task does not repeat. */
export function recurrenceSummary(task: Repeating) {
  const recurrence = read(task);
  return recurrence ? describeRecurrence(recurrence) : null;
}

/** The date the next occurrence would have if the task were finished today. */
export function nextDueDate(task: Repeating, today: string): TaskDate | null {
  const recurrence = read(task);
  if (!recurrence || !task.dueAt) return null;
  return nextOccurrence(
    recurrence,
    { at: task.dueAt, hasTime: task.dueHasTime },
    today,
  );
}
