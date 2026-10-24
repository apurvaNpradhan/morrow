import { describe, expect, it } from "vite-plus/test";
import { carryFieldValues } from "./move-fields.js";

const option = (id: string, name: string) => ({
  id,
  name,
  color: "#a1a1aa" as const,
  position: id,
});

const from = [
  {
    id: "f-size",
    name: "Size",
    type: "single_choice" as const,
    options: [option("s-l", "L"), option("s-xl", "XL")],
  },
  {
    id: "f-areas",
    name: "Areas",
    type: "multi_choice" as const,
    options: [option("a-api", "API"), option("a-web", "Web")],
  },
  { id: "f-points", name: "Points", type: "number" as const, options: [] },
  { id: "f-note", name: "Note", type: "text" as const, options: [] },
];
const to = [
  {
    id: "g-size",
    name: "size",
    type: "single_choice" as const,
    options: [option("t-l", "l")],
  },
  {
    id: "g-areas",
    name: "Areas",
    type: "multi_choice" as const,
    options: [option("b-web", "web")],
  },
  // Same name, other type: no match.
  { id: "g-points", name: "Points", type: "text" as const, options: [] },
];

describe("carryFieldValues", () => {
  it("rewrites matched values to the destination's ids", () => {
    expect(
      carryFieldValues(from, to, { "f-size": "s-l", "f-areas": ["a-web"] }),
    ).toEqual({
      values: { "g-size": "t-l", "g-areas": ["b-web"] },
      dropped: [],
    });
  });

  it("drops a missing Field, another type and an unmatched option, by name", () => {
    expect(
      carryFieldValues(from, to, {
        "f-size": "s-xl",
        "f-points": 5,
        "f-note": "hello",
      }),
    ).toEqual({
      values: {},
      dropped: [
        { field: "Size", value: "XL" },
        { field: "Points", value: 5 },
        { field: "Note", value: "hello" },
      ],
    });
  });

  it("keeps the matching options of a multi choice and drops the rest", () => {
    expect(
      carryFieldValues(from, to, { "f-areas": ["a-api", "a-web"] }),
    ).toEqual({
      values: { "g-areas": ["b-web"] },
      dropped: [{ field: "Areas", value: ["API"] }],
    });
  });

  it("ignores a value whose Field or option no longer exists", () => {
    expect(
      carryFieldValues(from, to, { gone: "x", "f-size": "gone-option" }),
    ).toEqual({ values: {}, dropped: [] });
  });
});
