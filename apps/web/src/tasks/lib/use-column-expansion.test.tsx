import type { ProjectColumnRow } from "@morrow/sync-schemas";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { useColumnExpansion } from "./use-column-expansion";

function column(
  id: string,
  category: ProjectColumnRow["category"],
): ProjectColumnRow {
  return {
    id,
    projectId: "p",
    name: id,
    category,
    color: "#a1a1aa",
    position: id,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  } as ProjectColumnRow;
}

describe("useColumnExpansion", () => {
  it("writes a collapsed open lane to localStorage so it survives a reload", async () => {
    const todo = column("todo", "unstarted");
    const { result } = renderHook(() => useColumnExpansion("p-open", [todo]));
    act(() => result.current.toggle(todo));

    await waitFor(() =>
      expect(result.current.expandedIds.has("todo")).toBe(false),
    );
    expect(window.localStorage.getItem("device-preferences")).toContain(
      '"p-open":{"todo":false}',
    );
  });

  it("starts a re-created column at its default", () => {
    const old = column("todo", "unstarted");
    const { result, rerender } = renderHook(
      ({ columns }) => useColumnExpansion("p-recreate", columns),
      { initialProps: { columns: [old] } },
    );
    act(() => result.current.toggle(old));

    // A re-created Column gets a new id, so the collapsed entry does not apply.
    rerender({ columns: [column("todo-2", "unstarted")] });
    expect(result.current.expandedIds.has("todo-2")).toBe(true);
  });

  it("opens a done lane that starts collapsed", async () => {
    const done = column("done", "done");
    const { result } = renderHook(() => useColumnExpansion("p-done", [done]));
    expect(result.current.expandedClosedIds).toEqual([]);

    act(() => result.current.toggle(done));
    await waitFor(() =>
      expect(result.current.expandedClosedIds).toEqual(["done"]),
    );
  });
});
