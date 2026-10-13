import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import type { ORPCError } from "@orpc/client";
import { db, schema } from "../../apps/api/src/platform/database";
import { createApp } from "../../apps/api/src/index";
import { reconcileAdminRoles } from "../../apps/api/src/auth/access/admin-allowlist";
import { createTestClient } from "./helpers/orpc";
import { resetTestDatabase } from "./helpers/database";
import { signInWithOtp } from "./helpers/otp";

const origin = "http://localhost:5173";

function post(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return createApp().app.request(`/api/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", Origin: origin, ...headers },
    body: JSON.stringify(body),
  });
}

async function signUp(email: string) {
  const response = await signInWithOtp(post, email, { name: "Person" });
  expect(response.status).toBe(200);
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  const { user } = (await response.json()) as { user: { id: string } };
  return { id: user.id, cookie };
}

async function getRole(id: string) {
  const [user] = await db
    .select({ role: schema.userTable.role })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, id));
  return user.role;
}

async function listUsersStatus(cookie: string) {
  const { app } = createApp();
  const result = await createTestClient(app, { cookie })
    .admin.access()
    .then(
      () => 200,
      (error: unknown) => (error as ORPCError<string, unknown>).code,
    );
  return result === "FORBIDDEN" ? 403 : result;
}

beforeEach(resetTestDatabase);
afterEach(() => vi.unstubAllEnvs());

describe("API integration: admin allowlist", () => {
  it("makes a listed, verified email an administrator at sign-in", async () => {
    vi.stubEnv("ADMIN_EMAILS", "Owner@Example.com, other@example.com");
    const owner = await signUp("owner@example.com");
    const stranger = await signUp(`${randomUUID()}@example.com`);

    expect(await getRole(owner.id)).toBe("admin");
    expect(await getRole(stranger.id)).toBe("user");
    expect(await listUsersStatus(owner.cookie)).toBe(200);
    expect(await listUsersStatus(stranger.cookie)).toBe(403);
  });

  it("makes nobody an administrator when the allowlist is empty", async () => {
    vi.stubEnv("ADMIN_EMAILS", "");
    const first = await signUp("first@example.com");
    expect(await getRole(first.id)).toBe("user");
  });

  it("never grants admin to an unverified address, and reconciles at boot", async () => {
    vi.stubEnv("ADMIN_EMAILS", "owner@example.com,removed@example.com");
    const rows = [
      ["unverified", "owner@example.com", false, "user"],
      ["removed", "gone@example.com", true, "admin"],
      ["listed", "removed@example.com", true, "user"],
    ] as const;
    await db.insert(schema.userTable).values(
      rows.map(([id, email, emailVerified, role]) => ({
        id,
        name: id,
        email,
        emailVerified,
        role,
        createdAt: new Date(),
      })),
    );

    await reconcileAdminRoles();

    expect(await getRole("unverified")).toBe("user");
    expect(await getRole("removed")).toBe("user");
    expect(await getRole("listed")).toBe("admin");
  });

  it("lets the owner sign up while registration is closed", async () => {
    vi.stubEnv("ADMIN_EMAILS", "owner@example.com");
    vi.stubEnv("REGISTRATION_OPEN", "false");
    const owner = await signUp("owner@example.com");
    expect(await getRole(owner.id)).toBe("admin");
    const response = await signInWithOtp(post, "stranger@example.com");
    expect(response.status).toBe(403);
  });

  it.each([
    ["/admin/set-role", (id: string) => ({ userId: id, role: "admin" })],
    [
      "/admin/update-user",
      (id: string) => ({ userId: id, data: { role: "admin" } }),
    ],
    [
      "/admin/create-user",
      () => ({ email: "made@example.com", password: "x", name: "x" }),
    ],
  ])("refuses %s even for an administrator", async (path, body) => {
    vi.stubEnv("ADMIN_EMAILS", "owner@example.com");
    const owner = await signUp("owner@example.com");
    const other = await signUp("other@example.com");

    const response = await post(path, body(other.id), { Cookie: owner.cookie });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "ADMIN_ROLE_MANAGED" });
    expect(await getRole(other.id)).toBe("user");
  });
});
