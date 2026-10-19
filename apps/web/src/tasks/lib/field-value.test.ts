import { describe, expect, it } from "vite-plus/test";
import { heldFields, optionHeld } from "./field-value";

const option = (id: string) => ({
  id,
  name: id,
  color: "#ef4444" as const,
  position: "a0",
});
const field = (id: string, ...options: string[]) =>
  ({
    id,
    projectId: "p1",
    name: id,
    type: "single_choice",
    position: "a0",
    options: options.map(option),
    createdAt: new Date(0),
    updatedAt: new Date(0),
  }) as const;

describe("optionHeld", () => {
  it("finds the option the task holds", () => {
    expect(
      optionHeld(field("size", "small", "large"), { size: "large" }),
    ).toMatchObject({
      id: "large",
    });
  });

  it("ignores a missing key, an unknown option id and another Field's value", () => {
    const size = field("size", "small");
    expect(optionHeld(size, {})).toBeUndefined();
    expect(optionHeld(size, { size: "ghost" })).toBeUndefined();
    expect(optionHeld(size, { other: "small" })).toBeUndefined();
  });
});

describe("heldFields", () => {
  it("lists only Fields with a live value, in Field order", () => {
    const fields = [
      field("size", "small"),
      field("team", "red"),
      field("area", "x"),
    ];
    const held = heldFields(fields, {
      team: "red",
      size: "small",
      area: "gone",
    });
    expect(held.map((entry) => entry.field.id)).toEqual(["size", "team"]);
  });
});
