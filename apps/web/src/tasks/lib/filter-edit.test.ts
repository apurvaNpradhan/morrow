import { describe, expect, it } from "vite-plus/test";
import {
  removeFilter,
  setFilterNegated,
  toggleFilterValue,
} from "./filter-edit";

describe("toggleFilterValue", () => {
  it("starts a filter with one value as 'is'", () => {
    expect(toggleFilterValue([], "priority", "high")).toEqual([
      { subject: "priority", operator: "is", values: ["high"] },
    ]);
  });

  it("widens to 'is any of' with a second value and narrows back", () => {
    const two = toggleFilterValue(
      toggleFilterValue([], "priority", "high"),
      "priority",
      "urgent",
    );
    expect(two[0]).toEqual({
      subject: "priority",
      operator: "isAnyOf",
      values: ["high", "urgent"],
    });
    expect(toggleFilterValue(two, "priority", "high")[0]).toEqual({
      subject: "priority",
      operator: "is",
      values: ["urgent"],
    });
  });

  it("keeps an exclusion an exclusion as values change", () => {
    const excluded = setFilterNegated(
      toggleFilterValue([], "assignee", "me"),
      "assignee",
      true,
    );
    expect(excluded[0]?.operator).toBe("isNot");
    expect(
      toggleFilterValue(excluded, "assignee", "unassigned")[0]?.operator,
    ).toBe("isNoneOf");
  });

  it("drops the filter when its last value goes", () => {
    const one = toggleFilterValue([], "column", "todo");
    expect(toggleFilterValue(one, "column", "todo")).toEqual([]);
  });

  it("leaves other subjects alone", () => {
    const filters = toggleFilterValue(
      toggleFilterValue([], "priority", "high"),
      "assignee",
      "me",
    );
    expect(filters.map((filter) => filter.subject)).toEqual([
      "priority",
      "assignee",
    ]);
    expect(removeFilter(filters, "priority")).toEqual([
      { subject: "assignee", operator: "is", values: ["me"] },
    ]);
  });
});
