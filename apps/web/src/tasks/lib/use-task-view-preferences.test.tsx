import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const fields = vi.hoisted(() => ({ current: [] as unknown[] }));
vi.mock("@/projects", () => ({ useProjectFields: () => fields.current }));

const { useTaskViewPreferences } = await import("./use-task-view-preferences");

beforeEach(() => {
  window.localStorage.clear();
  fields.current = [];
});

describe("showing a Field's value on cards", () => {
  it("is on for every Field until this device switches it off, per Field id", async () => {
    const { result } = renderHook(() => useTaskViewPreferences("p-show"));
    expect(result.current.showsField("size")).toBe(true);

    act(() => result.current.setShowField("size", false));

    expect(result.current.showsField("size")).toBe(false);
    expect(result.current.showsField("customer")).toBe(true);
    expect(window.localStorage.getItem("device-preferences")).toContain(
      '"showTaskFields":{"size":false}',
    );
  });

  it("is shared by the Project's Fields on this device, and comes back on with Reset", () => {
    const { result } = renderHook(() => useTaskViewPreferences("p-reset"));
    act(() => result.current.setShowField("size", false));
    act(() => result.current.setShowField("customer", false));
    act(() => result.current.setShowField("customer", true));
    expect(result.current.showsField("customer")).toBe(true);
    expect(result.current.showsField("size")).toBe(false);

    act(() => result.current.reset());

    expect(result.current.showsField("size")).toBe(true);
  });
});

describe("stored filters and sorts that name a deleted Field", () => {
  const field = (id: string, ...options: string[]) => ({
    id,
    options: options.map((option) => ({ id: option, position: option })),
  });

  it("are not applied once the Field is gone, and are applied while it exists", () => {
    fields.current = [field("size", "small")];
    const { result, rerender } = renderHook(() =>
      useTaskViewPreferences("p-prune"),
    );
    act(() => {
      result.current.setFilters([
        { subject: "field:size", operator: "is", values: ["small"] },
        { subject: "priority", operator: "is", values: ["high"] },
      ]);
      result.current.setSort({ field: "field:size", direction: "asc" });
    });
    expect(result.current.filters).toHaveLength(2);
    expect(result.current.sort.field).toBe("field:size");

    fields.current = [];
    rerender();

    expect(result.current.filters.map((f) => f.subject)).toEqual(["priority"]);
    expect(result.current.sort.field).toBe("manual");
  });
});
