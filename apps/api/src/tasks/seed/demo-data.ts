import type { ColumnCategory, TaskPriority } from "@morrow/sync-schemas";
import { generateNKeysBetween } from "fractional-indexing";

/** A small seeded generator (mulberry32), so every run makes the same data. */
export function createRandom(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (below: number) => Math.floor(next() * below);
  return {
    next,
    int,
    between: (min: number, max: number) => min + int(max - min + 1),
    chance: (probability: number) => next() < probability,
    pick: <T>(items: readonly T[]) => items[int(items.length)] as T,
    /** One of `entries`, chosen by weight. */
    weighted<T>(entries: ReadonlyArray<readonly [T, number]>) {
      const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
      let roll = next() * total;
      for (const [value, weight] of entries) {
        roll -= weight;
        if (roll < 0) return value;
      }
      return entries[entries.length - 1]![0];
    },
  };
}
export type Random = ReturnType<typeof createRandom>;

const ID_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

/** A Task id in the shape the browser generates (a letter and 23 more). */
export function taskId(random: Random) {
  let id = ID_CHARS[random.int(26)]!;
  for (let at = 1; at < 24; at += 1) id += ID_CHARS[random.int(36)]!;
  return id;
}

const VERBS = [
  "Fix",
  "Improve",
  "Refactor",
  "Add",
  "Document",
  "Migrate",
  "Investigate",
  "Polish",
  "Remove",
  "Speed up",
  "Test",
  "Review",
];
const NOUNS = [
  "search index",
  "billing page",
  "login flow",
  "export job",
  "webhook retries",
  "onboarding emails",
  "dashboard charts",
  "file uploads",
  "notification settings",
  "audit log",
  "permissions check",
  "rate limiter",
  "cache layer",
  "mobile layout",
  "dark theme",
  "CSV import",
  "session handling",
  "invoice totals",
  "release script",
  "error pages",
];
const CONTEXTS = [
  "for large workspaces",
  "on slow connections",
  "after the last release",
  "before the launch",
  "in the admin area",
  "for new members",
  "behind a flag",
  "in staging",
  "for the API",
  "on mobile",
];
const SENTENCES = [
  "Reported by a customer this week and reproducible on a fresh account.",
  "The current behaviour is confusing and the fix is small once the cause is clear.",
  "Needs a decision on scope before it can start; see the linked discussion.",
  "Blocked until the staging data is refreshed.",
  "Keep the change behind the existing flag and remove the flag in a follow-up.",
  "Check the logs from the last incident first, the trace is attached there.",
  "No design needed, follow the existing patterns in the settings pages.",
];
const CHECKLIST_ITEMS = [
  "Reproduce the problem",
  "Write a failing test",
  "Implement the change",
  "Update the docs",
  "Check the mobile layout",
  "Ask for review",
  "Roll out behind the flag",
  "Remove the old code path",
];

export function demoTitle(random: Random) {
  return `${random.pick(VERBS)} ${random.pick(NOUNS)}${
    random.chance(0.6) ? ` ${random.pick(CONTEXTS)}` : ""
  }`;
}

/** A markdown description; about one in five carries a checklist. */
export function demoDescription(random: Random) {
  const paragraph = Array.from({ length: random.between(1, 3) }, () =>
    random.pick(SENTENCES),
  ).join(" ");
  if (!random.chance(0.2)) return paragraph;
  const items = Array.from(
    { length: random.between(2, 6) },
    (_, at) => CHECKLIST_ITEMS[at % CHECKLIST_ITEMS.length]!,
  );
  const ticked = random.int(items.length + 1);
  const list = items
    .map((item, at) => `- [${at < ticked ? "x" : " "}] ${item}`)
    .join("\n");
  return `${paragraph}\n\n${list}`;
}

export type DemoColumn = { id: string; category: ColumnCategory };

/** The mix the seed aims for: most of a mature Project's Tasks are closed. */
const CATEGORY_WEIGHTS = [
  ["backlog", 10],
  ["unstarted", 12],
  ["started", 8],
  ["done", 56],
  ["canceled", 14],
] as const satisfies ReadonlyArray<readonly [ColumnCategory, number]>;
const PRIORITY_WEIGHTS = [
  ["none", 40],
  ["low", 20],
  ["medium", 25],
  ["high", 12],
  ["urgent", 3],
] as const satisfies ReadonlyArray<readonly [TaskPriority, number]>;

const DAY = 86_400_000;

function calendarDay(time: number) {
  return new Date(time).toISOString().slice(0, 10);
}

/**
 * `count` Tasks of one Project, numbered 1..count in the order they were
 * created over the past year, spread over its Columns by `CATEGORY_WEIGHTS`
 * with about a tenth archived. Positions are balanced fractional keys per Column.
 */
export function demoTasks(
  random: Random,
  {
    projectId,
    columns,
    memberIds,
    count,
    now,
  }: {
    projectId: string;
    columns: readonly DemoColumn[];
    memberIds: readonly string[];
    count: number;
    now: number;
  },
) {
  const byCategory = new Map<ColumnCategory, DemoColumn>(
    columns.map((column) => [column.category, column]),
  );
  const rows = Array.from({ length: count }, (_, index) => {
    const category = random.weighted(CATEGORY_WEIGHTS);
    const column = byCategory.get(category)!;
    const closed = category === "done" || category === "canceled";
    const createdAt = new Date(now - (1 - index / count) * 365 * DAY);
    return {
      id: taskId(random),
      projectId,
      columnId: column.id,
      number: index + 1,
      title: demoTitle(random),
      description: demoDescription(random),
      priority: random.weighted(PRIORITY_WEIGHTS),
      assigneeId: random.chance(0.6) ? random.pick(memberIds) : null,
      dueDate:
        !closed && random.chance(0.25)
          ? calendarDay(now + random.between(-30, 60) * DAY)
          : null,
      position: "",
      completedAt: closed
        ? new Date(createdAt.getTime() + random.between(1, 60) * DAY)
        : null,
      archivedAt: random.chance(0.1)
        ? new Date(createdAt.getTime() + DAY)
        : null,
      createdBy: random.pick(memberIds),
      createdAt,
      updatedAt: createdAt,
    };
  });

  const perColumn = new Map<string, typeof rows>();
  for (const row of rows) {
    const inColumn = perColumn.get(row.columnId);
    if (inColumn) inColumn.push(row);
    else perColumn.set(row.columnId, [row]);
  }
  for (const inColumn of perColumn.values()) {
    const keys = generateNKeysBetween(null, null, inColumn.length);
    inColumn.forEach((row, at) => {
      row.position = keys[at]!;
    });
  }
  return rows;
}
