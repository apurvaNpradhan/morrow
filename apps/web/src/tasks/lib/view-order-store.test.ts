import type { TaskRow } from "@morrow/sync-schemas";
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  clearView,
  neighborInView,
  placeInOrder,
  publishView,
} from "./view-order-store";

const task = (id: string) => ({ id }) as TaskRow;

afterEach(clearView);

describe("neighborInView", () => {
  it("steps through the published order and stops at the ends", () => {
    publishView({
      tasks: [task("a"), task("b"), task("c")],
      lanes: null,
      reveal: () => {},
    });
    expect(neighborInView("b", 1)?.id).toBe("c");
    expect(neighborInView("b", -1)?.id).toBe("a");
    expect(neighborInView("c", 1)).toBeUndefined();
    expect(neighborInView("a", -1)).toBeUndefined();
  });

  it("knows nothing about a task that is not in the view", () => {
    publishView({ tasks: [task("a")], lanes: null, reveal: () => {} });
    expect(neighborInView("zzz", 1)).toBeUndefined();
    clearView();
    expect(neighborInView("a", 1)).toBeUndefined();
  });
});

describe("placeInOrder", () => {
  it("keeps the order of the view that was just left, for the full page", () => {
    publishView({
      tasks: [task("a"), task("b"), task("c")],
      lanes: null,
      reveal: () => {},
    });
    clearView();
    expect(placeInOrder("b")).toMatchObject({ position: 2, total: 3 });
    expect(placeInOrder("b")?.next?.id).toBe("c");
    expect(placeInOrder("a")?.previous).toBeUndefined();
    expect(placeInOrder("zzz")).toBeNull();
  });
});
