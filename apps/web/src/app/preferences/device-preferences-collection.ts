import {
  createCollection,
  localStorageCollectionOptions,
} from "@tanstack/react-db";
import { z } from "zod";
import {
  FILTER_OPERATORS,
  type FilterSubject,
  isFilterSubject,
  isSortField,
  type SortField,
} from "./task-view-options";

/**
 * Settings that belong to this browser, not to the signed-in user: they stay
 * after sign-out and sync between open tabs through the storage event. One row.
 */
export const DEVICE_PREFERENCES_ID = "device";

/** The properties a sub-task row can show in the task sheet. */
export const SUB_TASK_PROPERTIES = [
  "priority",
  "id",
  "status",
  "labels",
  "dueDate",
  "assignee",
] as const;
export type SubTaskProperty = (typeof SUB_TASK_PROPERTIES)[number];

/** How the sub-tasks of a task read in the sheet, the same for every task. */
export const subTaskViewSchema = z.object({
  sort: z.object({
    field: z.custom<SortField>(
      (value) => typeof value === "string" && isSortField(value),
    ),
    direction: z.enum(["asc", "desc"]),
  }),
  /** Closed sub-tasks: `all` lists them, `none` leaves them out. */
  completed: z.enum(["all", "none"]),
  /** A sub-task's own sub-tasks are listed under it. */
  nested: z.boolean(),
  show: z.record(z.enum(SUB_TASK_PROPERTIES), z.boolean()),
});
export type SubTaskView = z.infer<typeof subTaskViewSchema>;

export const DEFAULT_SUB_TASK_VIEW: SubTaskView = {
  sort: { field: "number", direction: "asc" },
  completed: "all",
  nested: true,
  show: {
    priority: true,
    id: true,
    status: true,
    labels: true,
    dueDate: true,
    assignee: true,
  },
};

export const devicePreferencesSchema = z.object({
  id: z.literal(DEVICE_PREFERENCES_ID),
  theme: z.enum(["light", "dark", "system"]).default("dark"),
  compactMode: z.boolean().default(false),
  sidebarDefaultOpen: z.boolean().default(true),
  showProjectBackgrounds: z.boolean().default(true),
  /** The layout a Project opens in. */
  taskView: z.enum(["board", "list"]).default("board"),
  /** What cards and rows show; every field is on until switched off. */
  showTaskNumbers: z.boolean().default(true),
  showTaskAssignees: z.boolean().default(true),
  showTaskStartDate: z.boolean().default(true),
  showTaskDueDates: z.boolean().default(true),
  showTaskPriority: z.boolean().default(true),
  /** The sub-task list of the task sheet. */
  subTaskView: subTaskViewSchema.default(DEFAULT_SUB_TASK_VIEW),
  /** Whether cards and rows show a custom Field's value, by Field id; on unless switched off. */
  showTaskFields: z.record(z.string(), z.boolean()).default({}),
  /** Filters and sort of each Project's board and list, by Project id. */
  taskFilters: z
    .record(
      z.string(),
      z.array(
        z.object({
          subject: z.custom<FilterSubject>(
            (value) => typeof value === "string" && isFilterSubject(value),
          ),
          operator: z.enum(FILTER_OPERATORS),
          values: z.array(z.string()),
        }),
      ),
    )
    .default({}),
  /**
   * Lanes the user expanded or collapsed on the board or list, by Project id
   * and Column id. A Column without an entry keeps its default. Column ids are
   * never reused, so a re-created Column starts at its default.
   */
  columnExpanded: z
    .record(z.string(), z.record(z.string(), z.boolean()))
    .default({}),
  taskSorts: z
    .record(
      z.string(),
      z.object({
        field: z.custom<SortField>(
          (value) => typeof value === "string" && isSortField(value),
        ),
        direction: z.enum(["asc", "desc"]),
      }),
    )
    .default({}),
});

export type DevicePreferences = z.infer<typeof devicePreferencesSchema>;
export type Theme = DevicePreferences["theme"];

export const devicePreferencesCollection = createCollection(
  localStorageCollectionOptions({
    id: "device-preferences",
    storageKey: "device-preferences",
    getKey: (row) => row.id,
    schema: devicePreferencesSchema,
    startSync: true,
  }),
);

// The previous store kept preferences under this key; they do not carry over.
try {
  localStorage.removeItem("user-preferences");
} catch {
  // Storage can be blocked; there is nothing to clean up then.
}
