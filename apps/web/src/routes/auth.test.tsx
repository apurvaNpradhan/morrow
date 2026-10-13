import { beforeEach, expect, it, vi } from "vite-plus/test";
import { Route } from "./auth";

const mocks = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/auth/lib/auth-client", () => ({ authClient: mocks }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  redirect: ({ to }: { to: string }) => new Error(`Redirect to ${to}`),
}));
const beforeLoad = Route.options.beforeLoad as (context: {
  location: { pathname: string };
}) => Promise<unknown>;

beforeEach(() => mocks.getSession.mockReset());

it.each(["/auth/sign-in", "/auth/sign-up", "/auth/verify-otp"])(
  "keeps the authenticated redirect on %s",
  async (pathname) => {
    mocks.getSession.mockResolvedValue({
      data: { user: { id: "existing-user" } },
    });
    await expect(beforeLoad({ location: { pathname } })).rejects.toThrow(
      "Redirect to /",
    );
  },
);
