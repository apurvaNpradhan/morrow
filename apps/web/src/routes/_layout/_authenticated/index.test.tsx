import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { Route } from "./index";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  redirect: (options: unknown) => ({ redirect: options }),
}));
vi.mock("@/onboarding/components/no-workspace-screen", () => ({
  NoWorkspaceScreen: () => null,
}));

const listMyWorkspaces = vi.fn();
vi.mock("@/workspace", () => ({
  listMyWorkspaces: (userId: string) => listMyWorkspaces(userId),
}));

const beforeLoad = (
  Route as unknown as {
    beforeLoad: (args: unknown) => unknown;
  }
).beforeLoad;

const acme = { id: "w1", slug: "acme" };
const globex = { id: "w2", slug: "globex" };

function run(workspaces: unknown[], activeOrganizationId: string | null) {
  listMyWorkspaces.mockReturnValue(workspaces);
  return () =>
    beforeLoad({
      context: {
        session: {
          user: { id: "u1" },
          session: { activeOrganizationId },
        },
      },
    });
}

afterEach(() => vi.clearAllMocks());

describe("/", () => {
  it("opens the last-used workspace", () => {
    expect(run([acme, globex], "w2")).toThrow();
    try {
      run([acme, globex], "w2")();
    } catch (error) {
      expect(error).toEqual({
        redirect: { to: "/$slug", params: { slug: "globex" }, replace: true },
      });
    }
  });

  it("falls back to another workspace when the last-used one no longer includes the user", () => {
    for (const [workspaces, active, slug] of [
      [[acme], "gone", "acme"],
      [[acme, globex], null, "acme"],
    ] as const) {
      try {
        run([...workspaces], active)();
        expect.unreachable();
      } catch (error) {
        expect(error).toMatchObject({ redirect: { params: { slug } } });
      }
    }
  });

  it("shows the no-workspace screen when the user has none", () => {
    expect(run([], null)()).toBeUndefined();
  });
});
