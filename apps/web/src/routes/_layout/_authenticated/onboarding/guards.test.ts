import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { Route as IndexRoute } from "./index";
import { Route as InviteRoute } from "./invite";
import { Route as WorkspaceRoute } from "./workspace";
import { Route as YouRoute } from "./you";
import { Route as LayoutRoute } from "../onboarding";

const loadOnboardingProgress = vi.fn();
const completeOnboarding = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  Outlet: () => null,
  redirect: (options: unknown) => ({ redirect: options }),
  useNavigate: () => vi.fn(),
}));
vi.mock("@/onboarding/lib/load-progress", () => ({
  loadOnboardingProgress: (user: unknown) => loadOnboardingProgress(user),
}));
vi.mock("@/app/lib/orpc", () => ({
  rpc: { onboarding: { complete: () => completeOnboarding() } },
}));
vi.mock("@/onboarding/components/you-step", () => ({ YouStep: () => null }));
vi.mock("@/onboarding/components/workspace-step", () => ({
  WorkspaceStep: () => null,
}));
vi.mock("@/onboarding/components/invite-teammates-step", () => ({
  InviteTeammatesStep: () => null,
}));
vi.mock("@/onboarding/use-finish-onboarding", () => ({
  useFinishOnboarding: () => vi.fn(),
}));
vi.mock("@/auth/lib/auth-client", () => ({ authClient: {} }));

type Guard = (args: {
  context: {
    session: { user: { id: string; onboardingCompletedAt?: Date } } | null;
  };
  search: { redirect?: string };
}) => Promise<unknown> | unknown;
const guard = (route: unknown) => (route as { beforeLoad: Guard }).beforeLoad;

const session = { user: { id: "u1" } };
const acme = { id: "w1", slug: "acme", name: "Acme" };

function progress(state: {
  hasName: boolean;
  hasWorkspace: boolean;
  owns: boolean;
}) {
  loadOnboardingProgress.mockResolvedValue({
    progress: {
      hasName: state.hasName,
      hasWorkspace: state.hasWorkspace,
      ownsWorkspace: state.owns,
    },
    workspaces: state.hasWorkspace ? [acme] : [],
    ownedWorkspace: state.owns ? acme : null,
  });
}

afterEach(() => vi.clearAllMocks());

describe("onboarding layout", () => {
  const finished = {
    user: { id: "u1", onboardingCompletedAt: new Date() },
  };

  function thrownBy(run: () => unknown) {
    try {
      run();
    } catch (thrown) {
      return thrown;
    }
    return undefined;
  }

  it("sends a finished user to where they were headed", () => {
    expect(
      thrownBy(() =>
        guard(LayoutRoute)({
          context: { session: finished },
          search: { redirect: "/acme/inbox" },
        }),
      ),
    ).toMatchObject({ redirect: { to: "/acme/inbox", replace: true } });
  });

  it("sends a finished user with no destination to the app root", () => {
    expect(
      thrownBy(() =>
        guard(LayoutRoute)({ context: { session: finished }, search: {} }),
      ),
    ).toMatchObject({ redirect: { to: "/" } });
  });

  it("lets an unfinished user in", () => {
    expect(
      guard(LayoutRoute)({ context: { session }, search: {} }),
    ).toBeUndefined();
  });
});

describe("/onboarding (resume)", () => {
  it("resumes at You for a brand-new user", async () => {
    progress({ hasName: false, hasWorkspace: false, owns: false });
    await expect(
      guard(IndexRoute)({ context: { session }, search: { redirect: "/x" } }),
    ).rejects.toEqual({
      redirect: {
        to: "/onboarding/you",
        search: { redirect: "/x" },
        replace: true,
      },
    });
  });

  it("resumes at Workspace once named", async () => {
    progress({ hasName: true, hasWorkspace: false, owns: false });
    await expect(
      guard(IndexRoute)({ context: { session }, search: {} }),
    ).rejects.toMatchObject({ redirect: { to: "/onboarding/workspace" } });
  });

  it("resumes at the invite step for someone who created a workspace", async () => {
    progress({ hasName: true, hasWorkspace: true, owns: true });
    await expect(
      guard(IndexRoute)({ context: { session }, search: {} }),
    ).rejects.toMatchObject({ redirect: { to: "/onboarding/invite" } });
  });

  it("completes and leaves for a named member of an invited workspace", async () => {
    progress({ hasName: true, hasWorkspace: true, owns: false });
    await expect(
      guard(IndexRoute)({
        context: { session },
        search: { redirect: "/acme/inbox" },
      }),
    ).rejects.toMatchObject({
      redirect: { to: "/acme/inbox", replace: true },
    });
    expect(completeOnboarding).toHaveBeenCalledOnce();
  });
});

describe("/onboarding/you", () => {
  it("shows the full flow to someone with no workspace yet", async () => {
    progress({ hasName: true, hasWorkspace: false, owns: false });
    await expect(
      guard(YouRoute)({ context: { session }, search: {} }),
    ).resolves.toMatchObject({
      hasWorkspace: false,
    });
  });

  it("shows the single step to someone who joined through an invitation", async () => {
    progress({ hasName: false, hasWorkspace: true, owns: false });
    await expect(
      guard(YouRoute)({ context: { session }, search: {} }),
    ).resolves.toMatchObject({
      hasWorkspace: true,
      workspaceSlug: "acme",
    });
  });

  it("moves on when name and workspace are both done", async () => {
    progress({ hasName: true, hasWorkspace: true, owns: true });
    await expect(
      guard(YouRoute)({ context: { session }, search: {} }),
    ).rejects.toMatchObject({ redirect: { to: "/onboarding/invite" } });
  });
});

describe("/onboarding/workspace", () => {
  it("sends someone without a name back to You", async () => {
    progress({ hasName: false, hasWorkspace: false, owns: false });
    await expect(
      guard(WorkspaceRoute)({ context: { session }, search: {} }),
    ).rejects.toMatchObject({ redirect: { to: "/onboarding/you" } });
  });

  it("skips ahead once a workspace exists", async () => {
    progress({ hasName: true, hasWorkspace: true, owns: true });
    await expect(
      guard(WorkspaceRoute)({ context: { session }, search: {} }),
    ).rejects.toMatchObject({ redirect: { to: "/onboarding/invite" } });
  });

  it("shows the step to a named user with no workspace", async () => {
    progress({ hasName: true, hasWorkspace: false, owns: false });
    await expect(
      guard(WorkspaceRoute)({ context: { session }, search: {} }),
    ).resolves.toBeUndefined();
  });
});

describe("/onboarding/invite", () => {
  it("is reachable by someone who owns a workspace", async () => {
    progress({ hasName: true, hasWorkspace: true, owns: true });
    await expect(
      guard(InviteRoute)({ context: { session }, search: {} }),
    ).resolves.toEqual({ workspace: acme });
  });

  it("is not reachable without creating a workspace", async () => {
    progress({ hasName: true, hasWorkspace: false, owns: false });
    await expect(
      guard(InviteRoute)({ context: { session }, search: {} }),
    ).rejects.toMatchObject({ redirect: { to: "/onboarding/workspace" } });
  });
});
