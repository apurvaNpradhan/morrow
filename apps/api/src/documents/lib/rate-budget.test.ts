import { describe, expect, it } from "vite-plus/test";
import { createRateBudget } from "./rate-budget";

const limits = {
  updatesPerSecond: 2,
  updateBurst: 3,
  bytesPerSecond: 100,
  byteBurst: 300,
};

describe("the page write budget", () => {
  it("lets a burst through, then asks the writer to wait", () => {
    let time = 0;
    const budget = createRateBudget(limits, () => time);

    expect(budget.take("ada", "page", 10)).toBeNull();
    expect(budget.take("ada", "page", 10)).toBeNull();
    expect(budget.take("ada", "page", 10)).toBeNull();
    expect(budget.take("ada", "page", 10)).toBe(1);
    time = 1_000;
    expect(budget.take("ada", "page", 10)).toBeNull();
  });

  it("counts bytes apart from updates", () => {
    const budget = createRateBudget(limits, () => 0);

    expect(budget.take("ada", "page", 250)).toBeNull();
    expect(budget.take("ada", "page", 100)).toBe(1);
  });

  it("keeps a budget per user and per page", () => {
    const budget = createRateBudget(limits, () => 0);
    for (let i = 0; i < 3; i++) budget.take("ada", "page", 1);

    expect(budget.take("ada", "page", 1)).not.toBeNull();
    expect(budget.take("grace", "page", 1)).toBeNull();
    expect(budget.take("ada", "other", 1)).toBeNull();
  });

  it("refills while the writer is away", () => {
    let time = 0;
    const budget = createRateBudget(limits, () => time);
    for (let i = 0; i < 3; i++) budget.take("ada", "page", 1);
    time = 60_000;

    expect(budget.take("ada", "page", 1)).toBeNull();
    expect(budget.take("ada", "page", 1)).toBeNull();
    expect(budget.take("ada", "page", 1)).toBeNull();
    expect(budget.take("ada", "page", 1)).not.toBeNull();
  });
});
