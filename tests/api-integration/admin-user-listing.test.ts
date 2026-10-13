import type { ORPCError } from "@orpc/client";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { db, schema } from "../../apps/api/src/platform/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createTestClient } from "./helpers/orpc";

async function createUser(
  overrides: Partial<typeof schema.userTable.$inferInsert> & {
    name: string;
    email: string;
  },
) {
  const [user] = await db
    .insert(schema.userTable)
    .values({
      id: `user-${randomUUID()}`,
      emailVerified: true,
      ...overrides,
    })
    .returning();
  return user;
}

function listUsers(
  app: ReturnType<typeof createApp>["app"],
  query: { search?: string; page?: number; limit?: number } = {},
) {
  return createTestClient(app).admin.users.list(query);
}

async function codeOf(promise: Promise<unknown>) {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  return (error as ORPCError<string, unknown>).code;
}

describe("API integration: admin user listing", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("rejects users who are not instance administrators", async () => {
    const member = await createUser({
      name: "Regular Member",
      email: "member@example.com",
    });
    mockAuthenticatedSession(member);
    const { app } = createApp();

    expect(await codeOf(listUsers(app))).toBe("FORBIDDEN");
  });

  it("accepts administrators whose role list includes admin", async () => {
    const admin = await createUser({
      name: "Multi Role Admin",
      email: "multi@example.com",
      role: "user,admin",
    });
    mockAuthenticatedSession(admin);
    const { app } = createApp();

    const body = await listUsers(app);
    expect(body.users.map((user) => user.id)).toEqual([admin.id]);
  });

  it("searches name and email case-insensitively", async () => {
    const admin = await createUser({
      name: "Instance Admin",
      email: "admin@example.com",
      role: "admin",
    });
    const alice = await createUser({
      name: "Alice Wonder",
      email: "alice@example.com",
    });
    const bob = await createUser({ name: "Bob Builder", email: "bob@corp.io" });
    await createUser({ name: "Carol", email: "carol@example.com" });
    mockAuthenticatedSession(admin);
    const { app } = createApp();

    const byName = await listUsers(app, { search: "ALICE" });
    expect(byName.total).toBe(1);
    expect(byName.users.map((user) => user.id)).toEqual([alice.id]);

    const byEmail = await listUsers(app, { search: "Corp" });
    expect(byEmail.total).toBe(1);
    expect(byEmail.users.map((user) => user.id)).toEqual([bob.id]);

    const wildcard = await listUsers(app, { search: "%" });
    expect(wildcard.total).toBe(0);
    expect(wildcard.users).toEqual([]);
  });

  it("pages newest users first and reports the total across pages", async () => {
    const admin = await createUser({
      name: "Instance Admin",
      email: "admin@example.com",
      role: "admin",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    const users = [];
    for (let index = 0; index < 4; index += 1) {
      users.push(
        await createUser({
          name: `Member ${index}`,
          email: `member-${index}@example.com`,
          createdAt: new Date(`2026-02-0${index + 1}T00:00:00Z`),
          banned: index === 3,
        }),
      );
    }
    mockAuthenticatedSession(admin);
    const { app } = createApp();

    const firstPage = await listUsers(app, { limit: 2, page: 1 });
    expect(firstPage.total).toBe(5);
    expect(firstPage.users.map((user) => user.id)).toEqual([
      users[3]?.id,
      users[2]?.id,
    ]);
    expect(firstPage.users[0]?.banned).toBe(true);
    expect(firstPage.users[1]?.banned).toBe(false);

    const lastPage = await listUsers(app, { limit: 2, page: 3 });
    expect(lastPage.total).toBe(5);
    expect(lastPage.users.map((user) => user.id)).toEqual([admin.id]);

    const beyond = await listUsers(app, { limit: 2, page: 4 });
    expect(beyond.users).toEqual([]);
    expect(beyond.total).toBe(5);
  });

  it("rejects invalid paging values", async () => {
    const admin = await createUser({
      name: "Instance Admin",
      email: "admin@example.com",
      role: "admin",
    });
    mockAuthenticatedSession(admin);
    const { app } = createApp();

    expect(await codeOf(listUsers(app, { page: 0 }))).toBe("BAD_REQUEST");
    expect(await codeOf(listUsers(app, { limit: 101 }))).toBe("BAD_REQUEST");
  });
});
