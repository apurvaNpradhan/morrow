/**
 * What Projects and their Columns are made of, shared by the API (which
 * validates writes) and the web app (which renders them). A value can only be
 * stored if it is listed here.
 */

/**
 * Every Column belongs to one category, in workflow order. A category, not a
 * name, says what a Column means: "In Review" and "Doing" are both `started`.
 */
export const COLUMN_CATEGORIES = [
  "backlog",
  "unstarted",
  "started",
  "done",
  "canceled",
] as const;
export type ColumnCategory = (typeof COLUMN_CATEGORIES)[number];

/**
 * Every project keeps at least one column in each of these: where new items
 * start, and where finished work goes.
 */
export const REQUIRED_COLUMN_CATEGORIES = [
  "unstarted",
  "done",
] as const satisfies readonly ColumnCategory[];

/** Named colours; the web app maps each to theme-aware design-system colours. */
export const COLUMN_COLORS = [
  "gray",
  "slate",
  "red",
  "orange",
  "amber",
  "green",
  "teal",
  "blue",
  "violet",
  "pink",
] as const;
export type ColumnColor = (typeof COLUMN_COLORS)[number];

export const DEFAULT_COLUMN_COLOR = {
  backlog: "gray",
  unstarted: "slate",
  started: "blue",
  done: "green",
  canceled: "red",
} as const satisfies Record<ColumnCategory, ColumnColor>;

/** The Columns a new Project starts with, in order. */
export const DEFAULT_COLUMNS = [
  { name: "Backlog", category: "backlog" },
  { name: "To Do", category: "unstarted" },
  { name: "In Progress", category: "started" },
  { name: "Done", category: "done" },
  { name: "Canceled", category: "canceled" },
] as const satisfies ReadonlyArray<{ name: string; category: ColumnCategory }>;

/** The Lucide icons a Project may use, by component name. */
export const PROJECT_ICONS = [
  "Layout",
  "LayoutGrid",
  "Layers",
  "Rocket",
  "Briefcase",
  "Bug",
  "Code",
  "Cpu",
  "Database",
  "Server",
  "Cloud",
  "Globe",
  "Compass",
  "Map",
  "Plane",
  "Flag",
  "Target",
  "Star",
  "Heart",
  "Smile",
  "Sparkles",
  "Zap",
  "Lightbulb",
  "Palette",
  "Camera",
  "Music",
  "Gamepad2",
  "Book",
  "FileText",
  "Folder",
  "GraduationCap",
  "Hammer",
  "Wrench",
  "Package",
  "ShoppingCart",
  "House",
  "Leaf",
] as const;
export type ProjectIcon = (typeof PROJECT_ICONS)[number];

/** 2–6 characters, upper-case letters and digits, starting with a letter. */
export const PROJECT_KEY_PATTERN = /^[A-Z][A-Z0-9]{1,5}$/;

/** Sorts rows by their fractional-index `position` (plain byte order). */
export function comparePosition(
  a: { position: string; id: string },
  b: { position: string; id: string },
) {
  if (a.position !== b.position) return a.position < b.position ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Sorts Columns as a board shows them: by category, then by position. */
export function compareColumns(
  a: { category: ColumnCategory; position: string; id: string },
  b: { category: ColumnCategory; position: string; id: string },
) {
  const byCategory =
    COLUMN_CATEGORIES.indexOf(a.category) -
    COLUMN_CATEGORIES.indexOf(b.category);
  return byCategory !== 0 ? byCategory : comparePosition(a, b);
}
