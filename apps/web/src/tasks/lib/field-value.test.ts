import type { ProjectFieldRow } from "@morrow/sync-schemas";
import { describe, expect, it } from "vite-plus/test";
import {
  fieldHeld,
  fieldValueText,
  formatFieldNumber,
  heldFields,
  optionsOf,
} from "./field-value";

const option = (id: string) => ({
  id,
  name: id,
  color: "#ef4444" as const,
  position: id,
});
const field = (
  id: string,
  type: ProjectFieldRow["type"] = "single_choice",
  options: string[] = [],
  config: ProjectFieldRow["config"] = {},
): ProjectFieldRow => ({
  id,
  projectId: "p1",
  name: id,
  type,
  position: "a0",
  options: options.map(option),
  config,
  createdAt: new Date(0),
  updatedAt: new Date(0),
});

describe("fieldHeld", () => {
  it("finds the option a single choice holds", () => {
    expect(
      fieldHeld(field("size", "single_choice", ["small", "large"]), {
        size: "large",
      }),
    ).toBe("large");
  });

  it("ignores a missing key, an unknown option id and another Field's value", () => {
    const size = field("size", "single_choice", ["small"]);
    expect(fieldHeld(size, {})).toBeUndefined();
    expect(fieldHeld(size, { size: "ghost" })).toBeUndefined();
    expect(fieldHeld(size, { other: "small" })).toBeUndefined();
  });

  it("holds a multi choice while any of its options is left", () => {
    const areas = field("areas", "multi_choice", ["a", "b"]);
    expect(fieldHeld(areas, { areas: ["a", "ghost"] })).toEqual(["a", "ghost"]);
    expect(fieldHeld(areas, { areas: ["ghost"] })).toBeUndefined();
    expect(optionsOf(areas, ["b", "a"]).map((o) => o.id)).toEqual(["a", "b"]);
  });

  it("ignores a value of the wrong type", () => {
    expect(fieldHeld(field("n", "number"), { n: "3" })).toBeUndefined();
    expect(fieldHeld(field("t", "text"), { t: 3 })).toBeUndefined();
    expect(fieldHeld(field("c", "checkbox"), { c: "true" })).toBeUndefined();
    expect(fieldHeld(field("n", "number"), { n: 0 })).toBe(0);
  });
});

describe("heldFields", () => {
  it("lists only Fields with a live value, in Field order", () => {
    const fields = [
      field("size", "single_choice", ["small"]),
      field("team", "single_choice", ["red"]),
      field("area", "single_choice", ["x"]),
      field("pts", "number"),
    ];
    const held = heldFields(fields, {
      team: "red",
      size: "small",
      area: "gone",
      pts: 0,
    });
    expect(held.map((entry) => entry.field.id)).toEqual([
      "size",
      "team",
      "pts",
    ]);
  });
});

describe("formatting", () => {
  it("reads a number the way its Field says", () => {
    expect(formatFieldNumber({}, 1234.5)).toBe("1,234.5");
    expect(formatFieldNumber({ unit: "pts" }, 3)).toBe("3 pts");
    expect(formatFieldNumber({ format: "percent" }, 40)).toBe("40%");
    expect(formatFieldNumber({ format: "currency", unit: "USD" }, 12)).toBe(
      "$12",
    );
    expect(formatFieldNumber({ format: "currency", unit: "USD" }, 12.5)).toBe(
      "$12.50",
    );
  });

  it("puts values in words", () => {
    expect(
      fieldValueText(field("a", "multi_choice", ["x", "y"]), ["y", "x"]),
    ).toBe("x, y");
    expect(
      fieldValueText(
        field("t", "text", [], { format: "url" }),
        "https://a.dev/x/",
      ),
    ).toBe("a.dev/x");
    expect(fieldValueText(field("c", "checkbox"), true)).toBe("c");
    expect(fieldValueText(field("d", "date"), "2026-11-01")).toMatch(/Nov/);
  });
});
