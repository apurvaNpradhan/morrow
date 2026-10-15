/**
 * What a task view can filter and sort by. The device preferences store the
 * chosen filters and sorts, so the vocabulary lives beside them; the tasks
 * vertical builds its matching and ordering on it.
 */

export const FILTER_SUBJECTS = [
  "assignee",
  "priority",
  "dueDate",
  "column",
] as const;
export type FilterSubject = (typeof FILTER_SUBJECTS)[number];

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
export type SortField = (typeof SORT_FIELDS)[number];
