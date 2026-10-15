import type { TaskPriority } from "@morrow/sync-schemas";

export const PRIORITY_TEXT_CLASSES = {
  none: "text-muted-foreground",
  low: "text-muted-foreground",
  medium: "text-foreground",
  high: "text-orange-500 dark:text-orange-400",
  urgent: "text-red-500 dark:text-red-400",
} as const satisfies Record<TaskPriority, string>;
