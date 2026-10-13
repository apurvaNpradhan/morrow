import type { ORPCError } from "@orpc/client";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { db, schema } from "../../apps/api/src/platform/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";
import { createTestClient } from "./helpers/orpc";

const { app } = createApp();
const code = (error: unknown) => (error as ORPCError<string, unknown>).code;

describe("account.me", () => {
  beforeEach(resetTestDatabase);

  it("rejects missing credentials with UNAUTHORIZED", async () => {
    mockAnonymousSession();
    const error = await createTestClient(app)
      .account.me()
      .catch((e: unknown) => e);
    expect(code(error)).toBe("UNAUTHORIZED");
  });

  it("returns the signed-in user", async () => {
    const { user } = await createWorkspaceMember();
    mockAuthenticatedSession(user);
    const me = await createTestClient(app).account.me();
    expect(me).toMatchObject({ id: user.id, email: user.email });
  });

  it("answers NOT_FOUND when the authenticated user no longer exists", async () => {
    const { user } = await createWorkspaceMember();
    // Preserve the authenticated identity to simulate deletion before the lookup.
    mockAuthenticatedSession(user);
    await db.delete(schema.userTable).where(eq(schema.userTable.id, user.id));
    const error = await createTestClient(app)
      .account.me()
      .catch((e: unknown) => e);
    expect(code(error)).toBe("NOT_FOUND");
  });
});
