import { describe, expect, it } from "vite-plus/test";
import { createBackoff } from "./backoff";

describe("createBackoff", () => {
  it("holds for a second after the first failure, then doubles up to a limit", () => {
    let time = 0;
    const backoff = createBackoff(() => time);
    expect(backoff.holding()).toBe(false);
    expect(backoff.fail()).toBe(1000);
    expect(backoff.holding()).toBe(true);
    time = 1000;
    expect(backoff.holding()).toBe(false);
    expect(backoff.fail()).toBe(2000);
    expect(backoff.fail()).toBe(4000);
    for (let i = 0; i < 10; i++) backoff.fail();
    expect(backoff.fail()).toBe(15_000);
  });

  it("waits at least as long as the server asked", () => {
    const backoff = createBackoff(() => 0);
    expect(backoff.fail(5000)).toBe(5000);
  });

  it("starts over after a success", () => {
    let time = 0;
    const backoff = createBackoff(() => time);
    backoff.fail();
    backoff.fail();
    backoff.succeed();
    expect(backoff.holding()).toBe(false);
    expect(backoff.fail()).toBe(1000);
  });
});
