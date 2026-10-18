import { z } from "zod";
import { colorHex, COLUMN_CATEGORIES } from "./projects.js";
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
const none = z.object({});

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
    "labels",
    z.object({ added: z.array(labelRef), removed: z.array(labelRef) }),
  ),
  event("archived", none),
  event("unarchived", none),
  event("description", none),
]);

export type TaskEvent = z.infer<typeof taskEventSchema>;
export type TaskEventType = TaskEvent["type"];
export type TaskEventLabelRef = z.infer<typeof labelRef>;
