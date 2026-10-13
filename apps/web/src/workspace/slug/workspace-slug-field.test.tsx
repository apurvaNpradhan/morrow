import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { WorkspaceSlugField } from "./workspace-slug-field";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

function renderField(
  status: Parameters<typeof WorkspaceSlugField>[0]["status"],
) {
  render(
    <WorkspaceSlugField
      value="acme"
      status={status}
      onChange={vi.fn()}
      hint="hint"
    />,
  );
}

describe("WorkspaceSlugField", () => {
  it.each(["taken", "reserved", "invalid"] as const)(
    "gives %s its own message and marks the input invalid",
    (status) => {
      renderField(status);
      expect(screen.getByText(`workspace:slug.${status}`)).toBeTruthy();
      expect(screen.getByRole("textbox").getAttribute("aria-invalid")).toBe(
        "true",
      );
    },
  );

  it("shows progress while checking and confirmation when available", () => {
    renderField("checking");
    expect(screen.getByText("workspace:slug.checking")).toBeTruthy();
    cleanup();
    renderField("available");
    expect(screen.getByText("workspace:slug.available")).toBeTruthy();
    expect(screen.getByRole("textbox").getAttribute("aria-invalid")).toBeNull();
  });

  it("shows the hint when there is nothing else to say", () => {
    renderField("idle");
    expect(screen.getByText("hint")).toBeTruthy();
  });
});
