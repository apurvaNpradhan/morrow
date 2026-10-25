import { z } from "zod";
import { namedFieldValueSchema } from "./fields.js";
import { colorHex, COLUMN_CATEGORIES } from "./projects.js";
import { RELATION_DIRECTIONS, RELATION_TYPES } from "./relations.js";
import { TASK_PRIORITIES } from "./tasks.js";

/**
 * What a Task's history records, shared by the API (which writes it) and the
 * web app (which renders it). An event is its `type` and a `data` payload;
 * payloads carry a snapshot of names, so history stays readable after a
 * Column, Label or Member is gone.
 */

const columnRef = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(COLUMN_CATEGORIES),
});
const personRef = z.object({ id: z.string(), name: z.string() }).nullable();
const labelRef = z.object({
  id: z.string(),
  name: z.string(),
  color: colorHex,
});
const fieldRef = z.object({ id: z.string(), name: z.string() });
const optionRef = z.object({
  id: z.string(),
  name: z.string(),
  color: colorHex,
});
/**
 * What a Field held, as a snapshot: one option, the options of a multi choice,
 * or the plain value of a text, number, date or checkbox Field. Null is no value.
 */
const fieldValueRef = z
  .union([
    optionRef,
    z.object({ options: z.array(optionRef) }),
    z.object({ value: z.union([z.string(), z.number(), z.literal(true)]) }),
  ])
  .nullable();
const none = z.object({});
// The other Task's ticket id is a snapshot; the direction is as this Task sees it.
const relationData = z.object({
  type: z.enum(RELATION_TYPES),
  direction: z.enum(RELATION_DIRECTIONS),
  ticketId: z.string(),
});

// Where a moved Task was or went, with names snapshotted so the entry reads on after a rename.
const movedEnd = z.object({
  projectId: z.string(),
  key: z.string(),
  name: z.string(),
  ticketId: z.string(),
  column: columnRef,
});

function event<Type extends string, Data extends z.ZodObject>(
  type: Type,
  data: Data,
) {
  return z.object({ type: z.literal(type), data });
}

export const taskEventSchema = z.discriminatedUnion("type", [
  event("created", none),
  event("imported", none),
  event("duplicated", z.object({ sourceTicketId: z.string() })),
  event("title", z.object({ from: z.string(), to: z.string() })),
  event("column", z.object({ from: columnRef, to: columnRef })),
  event(
    "priority",
    z.object({ from: z.enum(TASK_PRIORITIES), to: z.enum(TASK_PRIORITIES) }),
  ),
  event("assignee", z.object({ from: personRef, to: personRef })),
  event(
    "due_date",
    z.object({ from: z.string().nullable(), to: z.string().nullable() }),
  ),
  event(
    "start_date",
    z.object({ from: z.string().nullable(), to: z.string().nullable() }),
  ),
  event(
    "recurrence",
    z.object({ from: z.string().nullable(), to: z.string().nullable() }),
  ),
  event(
    "recurred",
    z.object({ direction: z.enum(["from", "to"]), ticketId: z.string() }),
  ),
  event(
    "labels",
    z.object({ added: z.array(labelRef), removed: z.array(labelRef) }),
  ),
  event(
    "field_changed",
    z.object({ field: fieldRef, from: fieldValueRef, to: fieldValueRef }),
  ),
  event("archived", none),
  event("unarchived", none),
  event("description", none),
  event(
    "parent",
    z.object({ from: z.string().nullable(), to: z.string().nullable() }),
  ),
  event("subtask_added", z.object({ ticketId: z.string() })),
  event("subtask_removed", z.object({ ticketId: z.string() })),
  event(
    "project_moved",
    z.object({
      from: movedEnd,
      to: movedEnd,
      droppedValues: z.array(
        z.object({ field: z.string(), value: namedFieldValueSchema }),
      ),
    }),
  ),
  event("relation_added", relationData),
  event("relation_removed", relationData),
]);

export type TaskEvent = z.infer<typeof taskEventSchema>;
export type TaskEventType = TaskEvent["type"];
export type TaskEventLabelRef = z.infer<typeof labelRef>;
export type TaskEventOptionRef = z.infer<typeof optionRef>;
export type TaskEventFieldValueRef = z.infer<typeof fieldValueRef>;
