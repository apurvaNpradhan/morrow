import type { FieldValues, TaskPriority } from "@morrow/sync-schemas";

/** What the create dialog has collected so far. */
export type TaskDraft = {
  projectId: string | undefined;
  columnId: string | undefined;
  title: string;
  description: string;
  priority: TaskPriority;
  assigneeId: string | null;
  dueDate: string | null;
  labelIds: string[];
  /** Custom Field values by Field id, for the chosen Project. */
  fieldValues: FieldValues;
};

export const EMPTY_DRAFT: TaskDraft = {
  projectId: undefined,
  columnId: undefined,
  title: "",
  description: "",
  priority: "none",
  assigneeId: null,
  dueDate: null,
  labelIds: [],
  fieldValues: {},
};

/** Whether closing would throw away something the user typed or chose. */
export function isDirty(draft: TaskDraft) {
  return (
    draft.title.trim() !== "" ||
    draft.description.trim() !== "" ||
    draft.priority !== "none" ||
    draft.assigneeId !== null ||
    draft.dueDate !== null ||
    draft.labelIds.length > 0 ||
    Object.keys(draft.fieldValues).length > 0
  );
}
