import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { Route } from "./accept.$inviteId";

const navigate = vi.fn();
const useSession = vi.fn();
const useGetInvitationDetails = vi.fn();
const acceptInvitation = vi.fn();
const signOut = vi.fn();
const clearCache = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
  useNavigate: () => navigate,
  useParams: () => ({ inviteId: "invitation-1" }),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => ({ clear: clearCache }),
}));

vi.mock("@/members/invitations/queries/use-get-invitation-details", () => ({
  useGetInvitationDetails: (invitationId: string) =>
    useGetInvitationDetails(invitationId),
}));

vi.mock("@/members/invitations/lib/accept-invitation", () => ({
  acceptInvitation: (id: string) => acceptInvitation(id),
}));

vi.mock("@/auth/lib/auth-client", () => ({
  authClient: {
    useSession: () => useSession(),
    signOut: () => signOut(),
  },
}));

vi.mock("@/design-system/toast", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  Trans: ({ i18nKey }: { i18nKey: string }) => <span>{i18nKey}</span>,
}));

const AcceptInvitation = (Route as unknown as { component: ComponentType })
  .component;

function mockInvitation() {
  useGetInvitationDetails.mockReturnValue({
    data: {
      valid: true,
      invitation: {
        id: "invitation-1",
        email: "invitee@morrow.test",
        workspaceName: "Morrow",
        inviterName: "Ada",
        expiresAt: "2999-01-01T00:00:00.000Z",
        status: "pending",
        expired: false,
      },
    },
    isLoading: false,
    error: null,
  });
}

function renderSignedOutInvitation() {
  useSession.mockReturnValue({ data: null, isPending: false });
  mockInvitation();
  render(<AcceptInvitation />);
}

function renderSignedInInvitation(
  onboardingCompletedAt: Date | null,
  email = "invitee@morrow.test",
) {
  useSession.mockReturnValue({
    data: {
      user: { email, name: "", onboardingCompletedAt },
    },
    isPending: false,
  });
  mockInvitation();
  render(<AcceptInvitation />);
}

afterEach(() => {
  cleanup();
  navigate.mockReset();
  acceptInvitation.mockReset();
  signOut.mockReset();
  clearCache.mockReset();
});

describe("AcceptInvitation", () => {
  it("sends an invitee without an account to sign-up with the invitation", () => {
    renderSignedOutInvitation();

    fireEvent.click(
      screen.getByRole("button", { name: "auth:invitation.createAccount" }),
    );

    expect(navigate).toHaveBeenCalledWith({
      to: "/auth/sign-up",
      search: { invitationId: "invitation-1", email: "invitee@morrow.test" },
    });
  });

  it("keeps the sign-in route for invitees who already have an account", () => {
    renderSignedOutInvitation();

    fireEvent.click(
      screen.getByRole("button", { name: "auth:invitation.signIn" }),
    );

    expect(navigate).toHaveBeenCalledWith({
      to: "/auth/sign-in",
      search: { invitationId: "invitation-1", email: "invitee@morrow.test" },
    });
  });

  it("accepts on arrival and asks only for the name when onboarding is unfinished", async () => {
    acceptInvitation.mockResolvedValue({ workspaceId: "w1", slug: "morrow" });
    renderSignedInInvitation(null);

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({ to: "/onboarding/you" }),
    );
    expect(acceptInvitation).toHaveBeenCalledWith("invitation-1");
  });

  it("accepts and goes straight into the workspace when already onboarded", async () => {
    acceptInvitation.mockResolvedValue({ workspaceId: "w1", slug: "morrow" });
    renderSignedInInvitation(new Date());

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: "/$slug",
        params: { slug: "morrow" },
      }),
    );
  });

  it("does not accept as a different account, and offers to switch", async () => {
    renderSignedInInvitation(new Date(), "someone-else@morrow.test");

    expect(
      screen.getByText("auth:invitation.emailMismatchTitle"),
    ).toBeInTheDocument();
    expect(acceptInvitation).not.toHaveBeenCalled();

    signOut.mockResolvedValue({ error: null });
    fireEvent.click(
      screen.getByRole("button", { name: "auth:invitation.switchAccount" }),
    );

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: "/auth/sign-in",
        search: { invitationId: "invitation-1", email: "invitee@morrow.test" },
      }),
    );
    expect(clearCache).toHaveBeenCalled();
  });

  it("treats the invited email case-insensitively", async () => {
    acceptInvitation.mockResolvedValue({ workspaceId: "w1", slug: "morrow" });
    renderSignedInInvitation(new Date(), "Invitee@Morrow.test");

    await waitFor(() => expect(acceptInvitation).toHaveBeenCalled());
    expect(
      screen.queryByText("auth:invitation.emailMismatchTitle"),
    ).not.toBeInTheDocument();
  });
});
