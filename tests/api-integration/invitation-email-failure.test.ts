import * as email from "@morrow/email";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { auth } from "../../apps/api/src/auth/config";
import { db, schema } from "../../apps/api/src/platform/database";
import { createApp } from "../../apps/api/src/index";
import { resetTestDatabase } from "./helpers/database";
import { signInWithOtp } from "./helpers/otp";

beforeEach(async () => {
  await resetTestDatabase();
});
const origin = "http://localhost:5173";
function post(path: string, body: unknown, cookie = "") {
  return createApp().app.request(`/api/auth${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      Cookie: cookie,
    },
    body: JSON.stringify(body),
  });
}
async function signedIn() {
  const response = await signInWithOtp(
    (path, body) => post(path, body),
    "account@example.com",
    { name: "Account" },
  );
  expect(response.status).toBe(200);
  return response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
}

describe("invitation email failure reporting", () => {
  it("reports failed send and resend, keeps the pending invitation, and allows retry", async () => {
    const cookie = await signedIn();
    const created = await post(
      "/organization/create",
      { name: "Invites", slug: "invites" },
      cookie,
    );
    expect(created.status).toBe(200);
    const organization = await created.json();
    const send = vi
      .spyOn(email, "sendWorkspaceInvitationEmail")
      .mockRejectedValue(new Error("private provider error"));
    const body = {
      organizationId: organization.id,
      email: "invitee@example.com",
      role: "member",
    };
    const failed = await post("/organization/invite-member", body, cookie);
    expect(failed.status).toBe(502);
    expect(await failed.json()).toMatchObject({
      code: "INVITATION_EMAIL_FAILED",
    });
    expect(await db.select().from(schema.invitationTable)).toHaveLength(1);
    expect(
      (
        await post(
          "/organization/invite-member",
          { ...body, resend: true },
          cookie,
        )
      ).status,
    ).toBe(502);
    send.mockResolvedValue({ success: true });
    expect(
      (
        await post(
          "/organization/invite-member",
          { ...body, resend: true },
          cookie,
        )
      ).status,
    ).toBe(200);
    expect(await db.select().from(schema.invitationTable)).toHaveLength(1);
    // The strict invitation behavior must not replace the global background handler.
    await expect(
      (await auth.$context).runInBackgroundOrAwait(
        Promise.reject(new Error("background")),
      ),
    ).resolves.toBeUndefined();
  });
});
