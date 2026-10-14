import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ORPCError } from "@orpc/client";
import { HttpError } from "@/app/lib/http-error";
import { Route } from "./$slug";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  Outlet: () => null,
  notFound: () => ({ notFound: true }),
  redirect: (options: unknown) => ({ redirect: options }),
}));
vi.mock("@/workspace/routing/workspace-not-found", () => ({
  WorkspaceNotFound: () => null,
}));
vi.mock("@/workspace/routing/use-canonical-workspace-url", () => ({
  useCanonicalWorkspaceUrl: vi.fn(),
}));
vi.mock("@/workspace/routing/use-remember-last-workspace", () => ({
  useRememberLastWorkspace: vi.fn(),
}));
vi.mock("@/design-system/page-title", () => ({ PageTitle: () => null }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const resolveWorkspaceBySlug = vi.fn();
vi.mock("@/workspace/routing/resolve-workspace-by-slug", () => ({
  resolveWorkspaceBySlug: (userId: string, slug: string) =>
    resolveWorkspaceBySlug(userId, slug),
}));
const beforeLoad = (
  Route as unknown as { beforeLoad: (args: unknown) => Promise<unknown> }
).beforeLoad;

function load(slug: string, pathname: string, searchStr = "", hash = "") {
  return beforeLoad({
    context: { session: { user: { id: "u1" } } },
    params: { slug },
    location: { pathname, searchStr, hash },
  });
}

afterEach(() => vi.clearAllMocks());

describe("/$slug", () => {
  it("provides the resolved workspace to its children", async () => {
    const workspace = {
      id: "w1",
      slug: "acme",
      name: "Acme",
      requestedSlug: "acme",
    };
    resolveWorkspaceBySlug.mockResolvedValue(workspace);
    await expect(load("acme", "/acme/inbox")).resolves.toEqual({ workspace });
  });

  it("redirects a former slug to the canonical URL, keeping the rest of the path", async () => {
    resolveWorkspaceBySlug.mockResolvedValue({
      id: "w1",
      slug: "acme-inc",
      requestedSlug: "acme",
    });
    await expect(
      load("acme", "/acme/settings/workspace/roles", "?tab=1"),
    ).rejects.toMatchObject({
      redirect: {
        to: "/acme-inc/settings/workspace/roles",
        search: { tab: "1" },
        replace: true,
      },
    });
  });

  it("reports an unknown slug and an inaccessible one identically", async () => {
    resolveWorkspaceBySlug.mockRejectedValue(new ORPCError("NOT_FOUND"));
    await expect(load("nope", "/nope")).rejects.toEqual({ notFound: true });
    resolveWorkspaceBySlug.mockRejectedValue(new ORPCError("NOT_FOUND"));
    await expect(load("private", "/private")).rejects.toEqual({
      notFound: true,
    });
  });

  it("surfaces other failures instead of pretending the workspace is missing", async () => {
    const error = new HttpError(500, "boom");
    resolveWorkspaceBySlug.mockRejectedValue(error);
    await expect(load("acme", "/acme")).rejects.toBe(error);
  });
});
