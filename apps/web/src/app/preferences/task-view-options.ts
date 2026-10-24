/**
 * What a task view can filter and sort by. The device preferences store the
 * chosen filters and sorts, so the vocabulary lives beside them; the tasks
 * vertical builds its matching and ordering on it.
 */

/**
 * A custom Field of the Project as a subject or sort: `field:<id>`. The built-in
 * subjects and sorts are fixed; Fields come and go with the Project.
 */
export type FieldSubject = `field:${string}`;

export function fieldSubject(fieldId: string): FieldSubject {
  return `field:${fieldId}`;
}

/** The Field id of a `field:<id>` subject or sort; null for a built-in one. */
export function fieldIdOf(subject: string): string | null {
  return subject.startsWith("field:") ? subject.slice("field:".length) : null;
}

/** The subjects every Project has; its Fields add `field:<id>` ones. */
export const FILTER_SUBJECTS = [
  "assignee",
  "priority",
  "dueDate",
  "column",
  "label",
  "relation",
] as const;
export type FilterSubject = (typeof FILTER_SUBJECTS)[number] | FieldSubject;

export function isFilterSubject(value: string): value is FilterSubject {
  return (
    (FILTER_SUBJECTS as readonly string[]).includes(value) ||
    (fieldIdOf(value) ?? "") !== ""
  );
}

export const FILTER_OPERATORS = ["is", "isNot", "isAnyOf", "isNoneOf"] as const;
export type FilterOperator = (typeof FILTER_OPERATORS)[number];

export const SORT_FIELDS = [
  "manual",
  "created",
  "priority",
  "dueDate",
  "title",
  "number",
] as const;
export type SortField = (typeof SORT_FIELDS)[number] | FieldSubject;

export function isSortField(value: string): value is SortField {
  return (
    (SORT_FIELDS as readonly string[]).includes(value) ||
    (fieldIdOf(value) ?? "") !== ""
  );
}
