import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vite-plus/test";
import { AppHotkeysProvider } from "@/app/commands/app-hotkeys-provider";
import { MenuHint, TooltipLabel } from "./tooltip-label";

afterEach(cleanup);

it("shows the registered key caps and keeps them out of the accessible name", () => {
  render(
    <AppHotkeysProvider>
      <button type="button" aria-label="Filter">
        <TooltipLabel label="Filter" hotkeyId="filterTasks" />
      </button>
    </AppHotkeysProvider>,
  );
  expect(screen.getByText("F")).toBeTruthy();
  expect(screen.getByText("F").closest("[aria-hidden]")).not.toBeNull();
  expect(screen.getByRole("button", { name: "Filter" })).toBeTruthy();
});

it("follows the registry's declaration", () => {
  render(
    <AppHotkeysProvider>
      <MenuHint hotkeyId="goHome" />
    </AppHotkeysProvider>,
  );
  expect(screen.getByText("G")).toBeTruthy();
  expect(screen.getByText("H")).toBeTruthy();
});

it("shows no caps without a hotkey id", () => {
  render(<TooltipLabel label="Plain" />);
  expect(screen.queryByText("F")).toBeNull();
});
