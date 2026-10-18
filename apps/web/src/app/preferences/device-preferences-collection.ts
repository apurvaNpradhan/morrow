import {
  createCollection,
  localStorageCollectionOptions,
} from "@tanstack/react-db";
import { z } from "zod";
import {
  FILTER_OPERATORS,
  FILTER_SUBJECTS,
  SORT_FIELDS,
} from "./task-view-options";

/**
 * Settings that belong to this browser, not to the signed-in user: they stay
 * after sign-out and sync between open tabs through the storage event. One row.
 */
export const DEVICE_PREFERENCES_ID = "device";

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
  showTaskDueDates: z.boolean().default(true),
  showTaskPriority: z.boolean().default(true),
  showTaskChecklist: z.boolean().default(true),
  /** Filters and sort of each Project's board and list, by Project id. */
  taskFilters: z
    .record(
      z.string(),
      z.array(
        z.object({
          subject: z.enum(FILTER_SUBJECTS),
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
        field: z.enum(SORT_FIELDS),
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
