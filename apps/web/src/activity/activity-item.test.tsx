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

  it.each([
    [
      "project.created",
      { projectKey: "MOR", projectName: "Morrow" },
      "Morrow (MOR) was created",
    ],
    [
      "project.archived",
      { projectKey: "MOR", projectName: "Morrow" },
      "Morrow (MOR) was archived",
    ],
    [
      "project.unarchived",
      { projectKey: "MOR", projectName: "Morrow" },
      "Morrow (MOR) was restored from the archive",
    ],
    [
      "project.deleted",
      { projectKey: "MOR", projectName: "Morrow" },
      "Morrow (MOR) was deleted",
    ],
    [
      "project.key_changed",
      { previousKey: "OLD", projectKey: "MOR" },
      "A project's key changed from OLD to MOR",
    ],
  ])("describes %s", async (type, eventData, text) => {
    await preloadNamespaces("en-US");
    render(
      <I18nextProvider i18n={i18n}>
        <ActivityItem
          activity={{
            type,
            actorName: "Casey",
            eventData,
            createdAt: "2026-10-08T10:00:00.000Z",
          }}
        />
      </I18nextProvider>,
    );

    expect(screen.getByText(text)).toBeInTheDocument();
  });
});
