import { describe, expect, it } from "vite-plus/test";
import { positionInLane, sameOrder } from "./lane-position";

const tasks = new Map(
  ["a0", "a1", "a2", "a3"].map((position) => [
    `t-${position}`,
    { id: `t-${position}`, position },
  ]),
);

describe("positionInLane", () => {
  it("goes between the neighbours it now has", () => {
    const position = positionInLane(
      ["t-a0", "t-a3", "t-a1", "t-a2"],
      "t-a3",
      tasks,
    );
    expect(position > "a0" && position < "a1").toBe(true);
  });

  it("goes before the first and after the last", () => {
    expect(positionInLane(["t-a2", "t-a0", "t-a1"], "t-a2", tasks) < "a0").toBe(
      true,
    );
    expect(positionInLane(["t-a0", "t-a1", "t-a2"], "t-a0", tasks) > "a2").toBe(
      false,
    );
    expect(positionInLane(["t-a1", "t-a2", "t-a0"], "t-a0", tasks) > "a2").toBe(
      true,
    );
  });

  it("takes any position in an empty lane", () => {
    expect(positionInLane(["t-a0"], "t-a0", tasks)).toBeTruthy();
  });

  it("throws when the moved task is missing", () => {
    expect(() => positionInLane(["t-a1"], "t-a0", tasks)).toThrow();
  });
});

describe("sameOrder", () => {
  it("compares lanes", () => {
    expect(sameOrder(["a", "b"], ["a", "b"])).toBe(true);
    expect(sameOrder(["a", "b"], ["b", "a"])).toBe(false);
    expect(sameOrder(["a"], ["a", "b"])).toBe(false);
  });
});
