import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { i18n, preloadNamespaces } from "@/app/i18n";
import { WorkspaceMembers } from "./workspace-members";

afterEach(() => cleanup());

function workspaceUsersPage(start: number, count: number) {
  return {
    total: 45,
    members: Array.from({ length: count }, (_, index) => {
      const number = start + index;
      return {
        id: `member-${number}`,
        role: "member",
        user: { name: `Member ${number}` },
      };
    }),
  };
}

describe("workspace home members", () => {
  it("paginates through every member and reports the total", async () => {
    await preloadNamespaces("en-US");
    const queryClient = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity, retry: false } },
    });
    const workspaceId = "workspace-1";
    const keyForOffset = (offset: number) => [
      "workspace-users",
      workspaceId,
      20,
      offset,
      "createdAt",
      "asc",
      undefined,
      undefined,
      undefined,
    ];
    queryClient.setQueryData(keyForOffset(0), workspaceUsersPage(1, 20));
    queryClient.setQueryData(keyForOffset(20), workspaceUsersPage(21, 20));
    queryClient.setQueryData(keyForOffset(40), workspaceUsersPage(41, 5));

    const view = render(
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          <WorkspaceMembers workspaceId={workspaceId} />
        </I18nextProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByText("Showing 1–20 of 45 members.")).toBeInTheDocument();
    expect(screen.getByText("Member 20")).toBeInTheDocument();
    expect(screen.queryByText("Member 21")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(
      screen.getByText("Showing 21–40 of 45 members."),
    ).toBeInTheDocument();
    expect(screen.getByText("Member 21")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(
      screen.getByText("Showing 41–45 of 45 members."),
    ).toBeInTheDocument();
    expect(screen.getByText("Member 45")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(
      screen.getByText("Showing 21–40 of 45 members."),
    ).toBeInTheDocument();

    queryClient.setQueryData(
      [
        "workspace-users",
        "workspace-2",
        20,
        0,
        "createdAt",
        "asc",
        undefined,
        undefined,
        undefined,
      ],
      workspaceUsersPage(1, 20),
    );
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          <WorkspaceMembers workspaceId="workspace-2" />
        </I18nextProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByText("Showing 1–20 of 45 members.")).toBeInTheDocument();

    view.rerender(
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          <WorkspaceMembers workspaceId={workspaceId} />
        </I18nextProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByText("Showing 1–20 of 45 members.")).toBeInTheDocument();
  });
});
