import { describe, expect, it } from "vite-plus/test";
import {
  matchesFilters,
  NO_FIELD_VALUE,
  pruneFieldFilters,
  type TaskFilter,
} from "./filters";

// 2026-10-15 is a Thursday; with a Monday start its week is 12th to 18th.
const context = { meId: "me-id", today: "2026-10-15", weekStartsOn: 1 };

function task(overrides: Partial<Parameters<typeof matchesFilters>[0]> = {}) {
  return {
    assigneeId: null,
    priority: "none" as const,
    dueDate: null,
    columnId: "todo",
    completedAt: null,
    labelIds: [] as string[],
    fieldValues: {} as Record<string, string>,
    ...overrides,
  };
}

const filter = (
  subject: TaskFilter["subject"],
  operator: TaskFilter["operator"],
  ...values: string[]
): TaskFilter => ({ subject, operator, values });

describe("matchesFilters", () => {
  it("matches everything without filters", () => {
    expect(matchesFilters(task(), [], context)).toBe(true);
  });

  it("filters by assignee, with Unassigned and the me shortcut", () => {
    const mine = task({ assigneeId: "me-id" });
    const theirs = task({ assigneeId: "other" });
    expect(
      matchesFilters(mine, [filter("assignee", "is", "me")], context),
    ).toBe(true);
    expect(
      matchesFilters(theirs, [filter("assignee", "is", "me")], context),
    ).toBe(false);
    expect(
      matchesFilters(task(), [filter("assignee", "is", "unassigned")], context),
    ).toBe(true);
    expect(
      matchesFilters(theirs, [filter("assignee", "is", "other")], context),
    ).toBe(true);
  });

  it("inverts with is not and is none of", () => {
    const high = task({ priority: "high" });
    expect(
      matchesFilters(high, [filter("priority", "isNot", "high")], context),
    ).toBe(false);
    expect(
      matchesFilters(task(), [filter("priority", "isNot", "high")], context),
    ).toBe(true);
    expect(
      matchesFilters(
        high,
        [filter("priority", "isNoneOf", "low", "medium")],
        context,
      ),
    ).toBe(true);
    expect(
      matchesFilters(
        high,
        [filter("priority", "isNoneOf", "low", "high")],
        context,
      ),
    ).toBe(false);
  });

  it("treats the values of one filter as alternatives and filters as all required", () => {
    const urgentMine = task({ priority: "urgent", assigneeId: "me-id" });
    const filters = [
      filter("priority", "isAnyOf", "high", "urgent"),
      filter("assignee", "is", "me"),
    ];
    expect(matchesFilters(urgentMine, filters, context)).toBe(true);
    expect(matchesFilters(task({ priority: "urgent" }), filters, context)).toBe(
      false,
    );
    expect(
      matchesFilters(task({ assigneeId: "me-id" }), filters, context),
    ).toBe(false);
  });

  it("filters by due date: overdue, this week, next week, none", () => {
    const due = (dueDate: string, completedAt: Date | null = null) =>
      task({ dueDate, completedAt });
    const overdue = [filter("dueDate", "is", "overdue")];
    expect(matchesFilters(due("2026-10-14"), overdue, context)).toBe(true);
    expect(matchesFilters(due("2026-10-15"), overdue, context)).toBe(false);
    expect(
      matchesFilters(due("2026-10-01", new Date()), overdue, context),
    ).toBe(false);

    const thisWeek = [filter("dueDate", "is", "thisWeek")];
    expect(matchesFilters(due("2026-10-12"), thisWeek, context)).toBe(true);
    expect(matchesFilters(due("2026-10-18"), thisWeek, context)).toBe(true);
    expect(matchesFilters(due("2026-10-19"), thisWeek, context)).toBe(false);

    const nextWeek = [filter("dueDate", "is", "nextWeek")];
    expect(matchesFilters(due("2026-10-19"), nextWeek, context)).toBe(true);
    expect(matchesFilters(due("2026-10-25"), nextWeek, context)).toBe(true);
    expect(matchesFilters(due("2026-10-26"), nextWeek, context)).toBe(false);

    const none = [filter("dueDate", "is", "none")];
    expect(matchesFilters(task(), none, context)).toBe(true);
    expect(matchesFilters(due("2026-10-15"), none, context)).toBe(false);
  });

  it("starts the week on the locale's first day", () => {
    const sunday = { ...context, weekStartsOn: 0 };
    const thisWeek = [filter("dueDate", "is", "thisWeek")];
    expect(
      matchesFilters(task({ dueDate: "2026-10-11" }), thisWeek, sunday),
    ).toBe(true);
    expect(
      matchesFilters(task({ dueDate: "2026-10-11" }), thisWeek, context),
    ).toBe(false);
  });

  it("filters by column", () => {
    expect(
      matchesFilters(task(), [filter("column", "is", "todo")], context),
    ).toBe(true);
    expect(
      matchesFilters(task(), [filter("column", "isNot", "todo")], context),
    ).toBe(false);
  });
});

describe("label filters", () => {
  const bug = task({ labelIds: ["bug", "design"] });
  const plain = task();

  it("has any of the chosen labels for is and is any of", () => {
    expect(matchesFilters(bug, [filter("label", "is", "bug")], context)).toBe(
      true,
    );
    expect(
      matchesFilters(
        bug,
        [filter("label", "isAnyOf", "ops", "design")],
        context,
      ),
    ).toBe(true);
    expect(
      matchesFilters(bug, [filter("label", "isAnyOf", "ops", "docs")], context),
    ).toBe(false);
    expect(matchesFilters(plain, [filter("label", "is", "bug")], context)).toBe(
      false,
    );
  });

  it("has none of the chosen labels for is not and is none of", () => {
    expect(
      matchesFilters(bug, [filter("label", "isNot", "bug")], context),
    ).toBe(false);
    expect(
      matchesFilters(
        bug,
        [filter("label", "isNoneOf", "ops", "design")],
        context,
      ),
    ).toBe(false);
    expect(
      matchesFilters(
        bug,
        [filter("label", "isNoneOf", "ops", "docs")],
        context,
      ),
    ).toBe(true);
    expect(
      matchesFilters(plain, [filter("label", "isNot", "bug")], context),
    ).toBe(true);
  });

  it("combines with other subjects", () => {
    const urgentBug = task({ labelIds: ["bug"], priority: "urgent" });
    const filters = [
      filter("label", "is", "bug"),
      filter("priority", "is", "urgent"),
    ];
    expect(matchesFilters(urgentBug, filters, context)).toBe(true);
    expect(matchesFilters(task({ labelIds: ["bug"] }), filters, context)).toBe(
      false,
    );
  });
});

describe("custom Field filters", () => {
  const size = (value?: string) =>
    task({ fieldValues: value ? { f1: value } : {} });

  it("matches the chosen options for is and is any of, and the rest for is not", () => {
    expect(
      matchesFilters(
        size("large"),
        [filter("field:f1", "is", "large")],
        context,
      ),
    ).toBe(true);
    expect(
      matchesFilters(
        size("small"),
        [filter("field:f1", "is", "large")],
        context,
      ),
    ).toBe(false);
    expect(
      matchesFilters(
        size("small"),
        [filter("field:f1", "isAnyOf", "small", "large")],
        context,
      ),
    ).toBe(true);
    expect(
      matchesFilters(
        size("large"),
        [filter("field:f1", "isNoneOf", "small", "large")],
        context,
      ),
    ).toBe(false);
    expect(
      matchesFilters(
        size("small"),
        [filter("field:f1", "isNot", "large")],
        context,
      ),
    ).toBe(true);
  });

  it("reads only the filtered Field's value", () => {
    const other = task({ fieldValues: { f2: "large" } });
    expect(
      matchesFilters(other, [filter("field:f1", "is", "large")], context),
    ).toBe(false);
  });

  it("has a No value choice that matches a missing key", () => {
    const noValue = [filter("field:f1", "is", NO_FIELD_VALUE)];
    expect(matchesFilters(size(), noValue, context)).toBe(true);
    expect(matchesFilters(size("large"), noValue, context)).toBe(false);
    expect(
      matchesFilters(
        size(),
        [filter("field:f1", "isAnyOf", "large", NO_FIELD_VALUE)],
        context,
      ),
    ).toBe(true);
    expect(
      matchesFilters(
        size("large"),
        [filter("field:f1", "isNot", NO_FIELD_VALUE)],
        context,
      ),
    ).toBe(true);
  });
});

describe("negated No value filters", () => {
  const held = task({ fieldValues: { f1: "large" } });
  const unset = task();

  it("is not No value keeps tasks that hold a value", () => {
    const filters = [filter("field:f1", "isNot", NO_FIELD_VALUE)];
    expect(matchesFilters(held, filters, context)).toBe(true);
    expect(matchesFilters(unset, filters, context)).toBe(false);
  });

  it("is none of keeps tasks holding any value other than the listed ones", () => {
    const filters = [filter("field:f1", "isNoneOf", NO_FIELD_VALUE, "small")];
    expect(matchesFilters(held, filters, context)).toBe(true);
    expect(matchesFilters(unset, filters, context)).toBe(false);
    expect(
      matchesFilters(task({ fieldValues: { f1: "small" } }), filters, context),
    ).toBe(false);
  });
});

describe("pruneFieldFilters", () => {
  const fields = [{ id: "f1", options: [{ id: "small" }, { id: "large" }] }];

  it("leaves built-in filters and live Field filters alone", () => {
    const filters = [
      filter("priority", "is", "high"),
      filter("field:f1", "isAnyOf", "small", NO_FIELD_VALUE),
    ];
    expect(pruneFieldFilters(filters, fields)).toEqual(filters);
  });

  it("drops a filter whose Field is gone", () => {
    expect(
      pruneFieldFilters([filter("field:gone", "is", "small")], fields),
    ).toEqual([]);
  });

  it("drops deleted options from a filter, and the filter when none is left", () => {
    expect(
      pruneFieldFilters(
        [filter("field:f1", "isAnyOf", "small", "deleted")],
        fields,
      ),
    ).toEqual([filter("field:f1", "is", "small")]);
    expect(
      pruneFieldFilters([filter("field:f1", "isNot", "deleted")], fields),
    ).toEqual([]);
  });

  it("returns the same array when nothing changed, so a view does not re-render", () => {
    const filters = [filter("field:f1", "is", "small")];
    expect(pruneFieldFilters(filters, fields)).toBe(filters);
  });
});
