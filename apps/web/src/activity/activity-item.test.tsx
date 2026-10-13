import { cleanup, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { i18n, preloadNamespaces } from "@/app/i18n";
import { ActivityItem } from "./activity-item";

afterEach(() => cleanup());

describe("workspace activity item", () => {
  it("renders a safe activity summary with actor and timestamp", async () => {
    await preloadNamespaces("en-US");
    render(
      <I18nextProvider i18n={i18n}>
        <ActivityItem
          activity={{
            type: "workspace.member_joined",
            actorName: "Casey",
            eventData: { memberName: "Riley" },
            createdAt: "2026-10-08T10:00:00.000Z",
          }}
        />
      </I18nextProvider>,
    );

    expect(screen.getByText("Riley joined the workspace")).toBeInTheDocument();
    expect(screen.getByText("Casey")).toBeInTheDocument();
    expect(screen.getByRole("time")).toHaveAttribute(
      "datetime",
      "2026-10-08T10:00:00.000Z",
    );
  });
});
