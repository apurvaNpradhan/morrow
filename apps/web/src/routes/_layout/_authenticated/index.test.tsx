import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { Route } from "./index";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  redirect: (options: unknown) => ({ redirect: options }),
}));
vi.mock("@/onboarding/components/no-workspace-screen", () => ({
  NoWorkspaceScreen: () => null,
}));
vi.mock("@/app/lib/http-error", () => ({
  isUnauthorizedError: () => false,
  handleUnauthorized: vi.fn(),
}));

const fetchQuery = vi.fn();
const prefetchQuery = vi.fn();
const beforeLoad = (
  Route as unknown as {
    beforeLoad: (args: unknown) => Promise<unknown>;
  }
).beforeLoad;

const acme = { id: "w1", slug: "acme" };
const globex = { id: "w2", slug: "globex" };

function run(workspaces: unknown[], activeOrganizationId: string | null) {
  fetchQuery.mockResolvedValue(workspaces);
  return beforeLoad({
    context: {
      queryClient: { fetchQuery, prefetchQuery },
      session: {
        user: { email: "a@b.c" },
        session: { activeOrganizationId },
      },
    },
  });
}

afterEach(() => vi.clearAllMocks());

describe("/", () => {
  it("opens the last-used workspace", async () => {
    await expect(run([acme, globex], "w2")).rejects.toEqual({
      redirect: { to: "/$slug", params: { slug: "globex" }, replace: true },
    });
  });

  it("falls back to another workspace when the last-used one no longer includes the user", async () => {
    await expect(run([acme], "gone")).rejects.toMatchObject({
      redirect: { params: { slug: "acme" } },
    });
    await expect(run([acme, globex], null)).rejects.toMatchObject({
      redirect: { params: { slug: "acme" } },
    });
  });

  it("loads workspaces and invitations together", async () => {
    await run([acme], "w1").catch(() => {});
    expect(fetchQuery).toHaveBeenCalledOnce();
    expect(prefetchQuery).toHaveBeenCalledOnce();
  });

  it("shows the no-workspace screen when the user has none", async () => {
    await expect(run([], null)).resolves.toBeUndefined();
  });
});
