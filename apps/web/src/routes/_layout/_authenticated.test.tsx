import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { Route } from "./_authenticated";

import { queryClient } from "@/app/query-client";
import { forgetSession } from "@/auth/lib/session";
const getSession = vi.fn();
const handleUnauthorized = vi.hoisted(() => vi.fn());
vi.mock("@/app/lib/http-error", () => ({ handleUnauthorized }));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  Outlet: () => null,
  redirect: (options: unknown) => ({ redirect: options }),
}));
vi.mock("@/auth/lib/auth-client", () => ({
  authClient: { getSession: () => getSession() },
}));
vi.mock("@/app/hooks/use-track-signup", () => ({ useTrackSignup: vi.fn() }));
// The layout preloads these; the guard is what is under test.
vi.mock("@/members", () => ({
  myInvitationCollection: { preload: vi.fn() },
  workspaceInvitationCollection: { preload: vi.fn() },
  workspaceMemberCollection: { preload: vi.fn() },
  workspaceMemberUserCollection: { preload: vi.fn() },
}));
vi.mock("@/projects", () => ({
  projectCollection: { preload: vi.fn() },
  projectColumnCollection: { preload: vi.fn() },
}));
vi.mock("@/workspace", () => ({
  workspaceCollection: { preload: vi.fn() },
  useLeaveLostWorkspace: vi.fn(),
  WorkspaceError: () => null,
}));

type Location = { href: string; pathname: string };
const beforeLoad = (
  Route as unknown as {
    beforeLoad: (args: { location: Location }) => Promise<unknown>;
  }
).beforeLoad;

const unfinished = { user: { id: "u1", onboardingCompletedAt: null } };
const finished = { user: { id: "u1", onboardingCompletedAt: new Date() } };

afterEach(() => {
  vi.clearAllMocks();
  forgetSession();
});

describe("authenticated layout guard", () => {
  it("sends an unfinished user into onboarding, remembering the deep link", async () => {
    getSession.mockResolvedValue({ data: unfinished });
    await expect(
      beforeLoad({
        location: { href: "/acme/inbox?x=1", pathname: "/acme/inbox" },
      }),
    ).rejects.toEqual({
      redirect: {
        to: "/onboarding",
        search: { redirect: "/acme/inbox?x=1" },
      },
    });
  });

  it("does not remember the bare entry points", async () => {
    getSession.mockResolvedValue({ data: unfinished });
    await expect(
      beforeLoad({ location: { href: "/", pathname: "/" } }),
    ).rejects.toEqual({
      redirect: { to: "/onboarding", search: { redirect: undefined } },
    });
  });

  it("lets an unfinished user stay in onboarding", async () => {
    getSession.mockResolvedValue({ data: unfinished });
    await expect(
      beforeLoad({
        location: { href: "/onboarding/you", pathname: "/onboarding/you" },
      }),
    ).resolves.toMatchObject({ session: unfinished });
  });

  it("does not gate a finished user", async () => {
    getSession.mockResolvedValue({ data: finished });
    await expect(
      beforeLoad({ location: { href: "/acme", pathname: "/acme" } }),
    ).resolves.toMatchObject({ session: finished, sessionError: false });
  });

  it("sends a signed-out visitor to sign-in", async () => {
    getSession.mockResolvedValue({ data: null });
    await expect(
      beforeLoad({ location: { href: "/acme", pathname: "/acme" } }),
    ).rejects.toEqual({
      redirect: { to: "/auth/sign-in", search: { redirect: "/acme" } },
    });
  });

  it("never sends anyone into onboarding when the session could not be read", async () => {
    getSession.mockRejectedValue(new Error("offline"));
    await expect(
      beforeLoad({ location: { href: "/acme", pathname: "/acme" } }),
    ).resolves.toEqual({ session: null, sessionError: true });
  });

  it("does not mistake a failed session request for a signed-out visitor", async () => {
    getSession.mockResolvedValue({ data: null, error: { status: 429 } });
    await expect(
      beforeLoad({ location: { href: "/acme", pathname: "/acme" } }),
    ).resolves.toEqual({ session: null, sessionError: true });
  });

  it("asks again after a failed session request", async () => {
    getSession.mockResolvedValueOnce({ data: null, error: { status: 503 } });
    await beforeLoad({ location: { href: "/acme", pathname: "/acme" } });
    getSession.mockResolvedValue({ data: finished });
    await expect(
      beforeLoad({ location: { href: "/acme", pathname: "/acme" } }),
    ).resolves.toMatchObject({ session: finished });
  });

  describe("with a cached session", () => {
    const location = { href: "/acme", pathname: "/acme" };
    const cacheStale = (session: unknown) =>
      queryClient.setQueryData(["session"], session, {
        updatedAt: Date.now() - 60_000,
      });

    it("navigates without waiting on a refresh of a stale session", async () => {
      cacheStale(finished);
      getSession.mockReturnValue(new Promise(() => {}));
      await expect(beforeLoad({ location })).resolves.toMatchObject({
        session: finished,
      });
      expect(getSession).toHaveBeenCalledTimes(1);
    });

    it("waits when there is nothing cached", async () => {
      let answer: (value: unknown) => void = () => {};
      getSession.mockReturnValue(new Promise((resolve) => (answer = resolve)));
      let settled = false;
      const pending = beforeLoad({ location }).then(() => (settled = true));
      await Promise.resolve();
      expect(settled).toBe(false);
      answer({ data: finished });
      await pending;
    });

    it("signs out when the background refresh finds no session", async () => {
      cacheStale(finished);
      getSession.mockResolvedValue({ data: null });
      await beforeLoad({ location });
      await vi.waitFor(() => expect(handleUnauthorized).toHaveBeenCalled());
    });
  });
});
