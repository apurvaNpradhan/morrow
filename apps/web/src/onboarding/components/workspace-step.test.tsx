import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { WorkspaceStep } from "./workspace-step";

const pending = { data: [] as unknown[] };
const join = vi.fn();
const joinState = { joiningId: null as string | null };

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("./onboarding-shell", () => ({
  OnboardingShell: ({
    segments,
    children,
  }: {
    segments: number;
    children: React.ReactNode;
  }) => (
    <div data-testid="shell" data-segments={segments}>
      {children}
    </div>
  ),
}));
vi.mock("./create-workspace-form", () => ({
  CreateWorkspaceForm: () => <form aria-label="create workspace" />,
}));
vi.mock("@/members/invitations/queries/use-pending-invitations", () => ({
  usePendingInvitations: () => pending,
}));
vi.mock("@/onboarding/use-join-invitation", () => ({
  useJoinInvitation: () => ({ join, joiningId: joinState.joiningId }),
}));

const invitation = {
  id: "inv-1",
  workspaceName: "Globex",
  inviterName: "Ada",
};

function renderStep() {
  render(<WorkspaceStep onCreated={vi.fn()} onJoined={vi.fn()} />);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  pending.data = [];
  joinState.joiningId = null;
});

describe("WorkspaceStep", () => {
  it("shows only the create form without invitations", () => {
    renderStep();
    expect(screen.getByRole("form", { name: "create workspace" })).toBeTruthy();
    expect(screen.queryByText("Globex")).toBeNull();
    expect(screen.queryByText("auth:onboarding.workspace.orCreate")).toBeNull();
  });

  it("lists invitations above the create form, with a Join action", () => {
    pending.data = [invitation];
    renderStep();
    expect(screen.getByText("Globex")).toBeTruthy();
    expect(screen.getByRole("form", { name: "create workspace" })).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "auth:onboarding.workspace.join" }),
    );
    expect(join).toHaveBeenCalledWith("inv-1");
  });

  it("collapses the progress bar to two segments once Join is chosen", () => {
    expect(
      (render(<WorkspaceStep onCreated={vi.fn()} onJoined={vi.fn()} />),
      screen.getByTestId("shell").dataset.segments),
    ).toBe("3");
    cleanup();

    joinState.joiningId = "inv-1";
    pending.data = [invitation];
    renderStep();
    expect(screen.getByTestId("shell").dataset.segments).toBe("2");
  });

  it("draws no progress bar on the standalone no-workspace screen", () => {
    render(<WorkspaceStep standalone onCreated={vi.fn()} onJoined={vi.fn()} />);
    expect(screen.getByTestId("shell").dataset.segments).toBe("0");
  });
});
