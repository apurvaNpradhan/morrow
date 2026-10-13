import { log } from "evlog";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { drainSignInEmails, queueSignInEmail } from "./sign-in-email-tasks";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("background sign-in emails", () => {
  it("returns before eligibility or delivery finishes and drains pending work", async () => {
    let release!: () => void;
    const deliver = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    expect(queueSignInEmail(deliver)).toBeUndefined();
    expect(deliver).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(deliver).toHaveBeenCalledOnce();
    let drained = false;
    const draining = drainSignInEmails().then((complete) => {
      drained = complete;
    });
    await Promise.resolve();
    expect(drained).toBe(false);
    release();
    await draining;
    expect(drained).toBe(true);
  });

  it.each([false, true])(
    "handles delivery failures without logging sensitive details (sync: %s)",
    async (sync) => {
      const logged = vi.spyOn(log, "error").mockImplementation(() => {});
      queueSignInEmail(() => {
        const failure = new Error(
          "provider-secret token=123456 recipient@example.com",
        );
        if (sync) throw failure;
        return Promise.reject(failure);
      });
      expect(await drainSignInEmails()).toBe(true);
      expect(logged).toHaveBeenCalledExactlyOnceWith({
        action: "auth.sign-in-email",
      });
    },
  );

  it("bounds shutdown waiting without discarding the pending send", async () => {
    vi.useFakeTimers();
    let release!: () => void;
    queueSignInEmail(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const draining = drainSignInEmails(100);
    await vi.advanceTimersByTimeAsync(100);
    expect(await draining).toBe(false);
    release();
    expect(await drainSignInEmails()).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
