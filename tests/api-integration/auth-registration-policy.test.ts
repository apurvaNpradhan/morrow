import * as email from "@morrow/email";
import { eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { db, schema } from "../../apps/api/src/platform/database";
import { createApp } from "../../apps/api/src/index";
import { assertUserRegistrationAllowed } from "../../apps/api/src/auth/registration/registration-policy";
import { drainSignInEmails } from "../../apps/api/src/auth/email/sign-in-email-tasks";
import { resetTestDatabase } from "./helpers/database";
import { signInWithOtp } from "./helpers/otp";
import { createWorkspaceMember } from "./helpers/fixtures";

const headers = {
  "content-type": "application/json",
  Origin: "http://localhost:5173",
};
async function post(
  path: string,
  body: unknown,
  extraHeaders: Record<string, string> = {},
  waitForEmail = true,
) {
  const response = await createApp().app.request(`/api/auth${path}`, {
    method: "POST",
    headers: { ...headers, ...extraHeaders },
    body: JSON.stringify(body),
  });
  if (waitForEmail) await drainSignInEmails();
  return response;
}
function signup(email: string, extraHeaders?: Record<string, string>) {
  return signInWithOtp(post, email, { name: "Test", headers: extraHeaders });
}
async function invitation(email: string) {
  const inviter = await createWorkspaceMember({ role: "owner" });
  const [row] = await db
    .insert(schema.invitationTable)
    .values({
      email,
      workspaceId: inviter.workspace.id,
      inviterId: inviter.user.id,
      role: "member",
      status: "pending",
      expiresAt: new Date(Date.now() + 60_000),
    })
    .returning();
  return row;
}

describe("auth registration boundaries", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("offers no anonymous sign-in on an initialized instance", async () => {
    await createWorkspaceMember();
    expect((await post("/sign-in/anonymous", {})).status).toBe(404);
    expect(await db.select().from(schema.userTable)).toHaveLength(1);
  });

  it("lets an invited address register by proving its mailbox, and nobody else", async () => {
    const invite = await invitation("invitee@example.com");
    vi.stubEnv("REGISTRATION_OPEN", "false");
    expect((await signup("other@example.com")).status).toBe(403);
    expect((await signup(invite.email)).status).toBe(200);
  });

  it("only accepts provider or mailbox verified email claims at the user-create boundary", async () => {
    await invitation("invitee@example.com");
    vi.stubEnv("REGISTRATION_OPEN", "false");
    for (const path of ["/callback/github", "/sign-in/email-otp"]) {
      await expect(
        assertUserRegistrationAllowed(
          { email: "invitee@example.com", emailVerified: false },
          { path },
        ),
      ).rejects.toMatchObject({ status: "FORBIDDEN" });
      await expect(
        assertUserRegistrationAllowed(
          { email: "invitee@example.com", emailVerified: true },
          { path },
        ),
      ).resolves.toBeUndefined();
    }
    await expect(
      assertUserRegistrationAllowed(
        { email: "invitee@example.com", emailVerified: true },
        { path: "/sign-in/social" },
      ),
    ).rejects.toMatchObject({ status: "FORBIDDEN" });
  });

  it("only emails sign-in OTPs to existing or invited addresses when registration is disabled", async () => {
    const member = await createWorkspaceMember();
    const invite = await invitation("invitee@example.com");
    vi.stubEnv("REGISTRATION_OPEN", "false");
    const sendOtp = vi
      .spyOn(email, "sendOtpEmail")
      .mockResolvedValue(undefined);

    for (const address of [
      member.user.email,
      invite.email,
      "stranger@example.com",
    ]) {
      expect(
        (
          await post("/email-otp/send-verification-otp", {
            email: address,
            type: "sign-in",
          })
        ).status,
      ).toBe(200);
    }

    const expectedRecipients = [invite.email, member.user.email].sort();
    const recipients = (mock: {
      mock: { calls: [to: string, subject: string, data: unknown][] };
    }) => mock.mock.calls.map((call) => call[0]).sort();
    expect(recipients(sendOtp)).toEqual(expectedRecipients);
  });

  it.each([["/email-otp/send-verification-otp", "sendOtpEmail"]] as const)(
    "returns from %s without waiting for email",
    async (path, method) => {
      const member = await createWorkspaceMember();
      const invite = await invitation("timing-invitee@example.com");
      vi.stubEnv("REGISTRATION_OPEN", "false");
      let releaseDelivery!: () => void;
      const blockedDelivery = new Promise<void>((resolve) => {
        releaseDelivery = resolve;
      });
      const send = vi.spyOn(email, method).mockReturnValue(blockedDelivery);
      const responses: { status: number; body: unknown }[] = [];
      const requests: Promise<Response>[] = [];

      try {
        for (const address of [
          member.user.email,
          invite.email,
          "unknown@example.com",
        ]) {
          const request = post(
            path,
            { email: address, type: "sign-in" },
            {},
            false,
          );
          requests.push(request);
          void request.then(async (response) => {
            responses.push({
              status: response.status,
              body: await response.json(),
            });
          });
        }
        // The email promise stays unresolved until all three HTTP responses arrive.
        await vi.waitFor(() => expect(responses).toHaveLength(3));
        expect(responses[0].status).toBe(200);
        expect(responses).toEqual([responses[0], responses[0], responses[0]]);
        await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));
        expect(send.mock.calls.map(([address]) => address).sort()).toEqual(
          [member.user.email, invite.email].sort(),
        );
      } finally {
        releaseDelivery();
        await Promise.all(requests);
        await drainSignInEmails();
      }
    },
  );

  it("stores a five-minute OTP expiry and rejects an expired code", async () => {
    const member = await createWorkspaceMember();
    const send = vi.spyOn(email, "sendOtpEmail").mockResolvedValue(undefined);
    const before = Date.now();
    expect(
      (
        await post("/email-otp/send-verification-otp", {
          email: member.user.email,
          type: "sign-in",
        })
      ).status,
    ).toBe(200);
    const rows = await db.select().from(schema.verificationTable);
    expect(rows).toHaveLength(1);
    expect(rows[0].expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + 300_000,
    );
    expect(rows[0].expiresAt.getTime()).toBeLessThanOrEqual(
      Date.now() + 300_000,
    );
    const data = send.mock.lastCall?.[2] as { otp: string };
    await db
      .update(schema.verificationTable)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.verificationTable.id, rows[0].id));
    expect(
      (
        await post("/sign-in/email-otp", {
          email: member.user.email,
          otp: data.otp,
        })
      ).status,
    ).toBe(400);
    expect(await db.select().from(schema.sessionTable)).toHaveLength(0);
  });
});
