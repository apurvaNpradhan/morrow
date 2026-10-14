import type { ColumnCategory, ColumnColor } from "@morrow/sync-schemas";
import {
  Circle,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleX,
  type LucideIcon,
} from "lucide-react";

/** Each colour token as a dot and a faint lane tint, readable in both themes. */
export const COLUMN_COLOR_CLASSES = {
  gray: {
    dot: "bg-zinc-400 dark:bg-zinc-500",
    lane: "bg-zinc-500/5",
  },
  slate: {
    dot: "bg-slate-500 dark:bg-slate-400",
    lane: "bg-slate-500/5",
  },
  red: { dot: "bg-red-500 dark:bg-red-400", lane: "bg-red-500/5" },
  orange: { dot: "bg-orange-500 dark:bg-orange-400", lane: "bg-orange-500/5" },
  amber: { dot: "bg-amber-500 dark:bg-amber-400", lane: "bg-amber-500/5" },
  green: { dot: "bg-green-500 dark:bg-green-400", lane: "bg-green-500/5" },
  teal: { dot: "bg-teal-500 dark:bg-teal-400", lane: "bg-teal-500/5" },
  blue: { dot: "bg-blue-500 dark:bg-blue-400", lane: "bg-blue-500/5" },
  violet: { dot: "bg-violet-500 dark:bg-violet-400", lane: "bg-violet-500/5" },
  pink: { dot: "bg-pink-500 dark:bg-pink-400", lane: "bg-pink-500/5" },
} as const satisfies Record<ColumnColor, { dot: string; lane: string }>;

/** A column's icon follows its category, so its meaning shows without configuration. */
export const CATEGORY_ICONS = {
  backlog: CircleDashed,
  unstarted: Circle,
  started: CircleDot,
  done: CircleCheck,
  canceled: CircleX,
} as const satisfies Record<ColumnCategory, LucideIcon>;
