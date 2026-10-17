import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { TaskChip } from "./task-chip";

afterEach(cleanup);

it("keeps a chip's press away from the card under it", () => {
  const press = vi.fn();
  const open = vi.fn();
  render(
    <div onPointerDown={press} onTouchStart={press}>
      <TaskChip label="Priority" onOpen={open}>
        P
      </TaskChip>
    </div>,
  );
  const chip = screen.getByRole("button", { name: "Priority" });
  fireEvent.pointerDown(chip);
  fireEvent.touchStart(chip);
  expect(press).not.toHaveBeenCalled();
  fireEvent.click(chip);
  expect(open).toHaveBeenCalledWith(chip);
});
