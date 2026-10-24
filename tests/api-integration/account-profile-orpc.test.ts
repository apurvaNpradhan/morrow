import type { ORPCError } from "@orpc/client";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { db, schema } from "../../apps/api/src/platform/database";
import { createApp } from "../../apps/api/src/index";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";
import { createTestClient } from "./helpers/orpc";

const { app } = createApp();
beforeEach(resetTestDatabase);

async function signedIn(email = "profile@example.com") {
  const { userId, cookies } = await signUpWithSession(app, {
    email,
    name: "Before",
  });
  return { userId, client: createTestClient(app, { cookie: cookies }) };
}

const userRow = async (id: string) =>
  (
    await db.select().from(schema.userTable).where(eq(schema.userTable.id, id))
  )[0];

describe("account.updateProfile", () => {
  it("changes the name and locale but never the picture", async () => {
    const { userId, client } = await signedIn();

    await client.account.updateProfile({ name: "After", locale: "en-US" });
    expect(await userRow(userId)).toMatchObject({
      name: "After",
      locale: "en-US",
      image: null,
    });
  });

  it("saves and clears a time zone", async () => {
    const { userId, client } = await signedIn();

    await client.account.updateProfile({ timeZone: "Asia/Kolkata" });
    expect(await userRow(userId)).toMatchObject({ timeZone: "Asia/Kolkata" });

    await client.account.updateProfile({ timeZone: null });
    expect(await userRow(userId)).toMatchObject({ timeZone: null });
  });

  it("refuses a time zone that is not an IANA name", async () => {
    const { client } = await signedIn();
    const error = await client.account
      .updateProfile({ timeZone: "Mars/Olympus" })
      .catch((e: unknown) => e);
    expect((error as ORPCError<string, unknown>).code).toBe("BAD_REQUEST");
  });

  it("refuses an empty name", async () => {
    const { client } = await signedIn();
    const error = await client.account
      .updateProfile({ name: "  " })
      .catch((e: unknown) => e);
    expect((error as ORPCError<string, unknown>).code).toBe("BAD_REQUEST");
  });
});

describe("account.deleteAccount", () => {
  it("deletes the signed-in account", async () => {
    const { userId, client } = await signedIn("leaving@example.com");
    await client.account.deleteAccount();
    expect(await userRow(userId)).toBeUndefined();
  });
});
