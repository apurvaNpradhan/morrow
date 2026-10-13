import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { Route } from "./_authenticated";

const getSession = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  Outlet: () => null,
  redirect: (options: unknown) => ({ redirect: options }),
}));
vi.mock("@/auth/lib/auth-client", () => ({
  authClient: { getSession: () => getSession() },
}));
vi.mock("@/app/hooks/use-track-signup", () => ({ useTrackSignup: vi.fn() }));

type Location = { href: string; pathname: string };
const beforeLoad = (
  Route as unknown as {
    beforeLoad: (args: { location: Location }) => Promise<unknown>;
  }
).beforeLoad;

const unfinished = { user: { id: "u1", onboardingCompletedAt: null } };
const finished = { user: { id: "u1", onboardingCompletedAt: new Date() } };

afterEach(() => vi.clearAllMocks());

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
});
