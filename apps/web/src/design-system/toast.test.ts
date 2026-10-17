import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const manager = vi.hoisted(() => ({
  add: vi.fn(),
  update: vi.fn(),
  close: vi.fn(),
}));
vi.mock("./ui/toast", () => ({ toastManager: manager }));

import { toast } from "./toast";

let nextId = 0;
beforeEach(() => {
  manager.add.mockReset().mockImplementation(() => `t${nextId++}`);
  manager.update.mockReset();
});

function closeLast() {
  manager.add.mock.calls.at(-1)?.[0].onClose();
}

describe("toast dedupe", () => {
  it("does not add a duplicate, shakes and restarts the existing toast", () => {
    const first = toast.success("Link copied");
    const second = toast.success("Link copied");
    expect(manager.add).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
    expect(manager.update).toHaveBeenCalledWith(
      first,
      expect.objectContaining({ data: { shake: 1 } }),
    );
  });

  it("adds when the type or title differs", () => {
    toast.success("Saved a");
    toast.error("Saved a");
    toast.success("Saved b");
    expect(manager.add).toHaveBeenCalledTimes(3);
  });

  it("allows the same toast again after it closes", () => {
    toast.info("Again");
    closeLast();
    toast.info("Again");
    expect(manager.add).toHaveBeenCalledTimes(2);
  });
});
