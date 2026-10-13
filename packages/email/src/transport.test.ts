import enUS from "@morrow/i18n/en-US.json";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

const send = vi.hoisted(() => vi.fn());
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

import { sendOtpEmail, sendWorkspaceInvitationEmail } from "./send-email";
import { configureEmail, type EmailSettings } from "./transport";

describe("email delivery", () => {
  let settings: EmailSettings;
  beforeEach(() => {
    settings = { consoleOnly: false, isProduction: false };
    configureEmail(() => settings);
    send.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs the rendered email to the console when no API key is set", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await sendOtpEmail("user@example.com", "Your code", {
      otp: "482913",
      copy: enUS.emails.otp,
      requestCopy: enUS.emails.requestDetails,
    });
    expect(send).not.toHaveBeenCalled();
    const line = String(info.mock.calls[0]?.[0]);
    expect(line).toContain("to=user@example.com");
    expect(line).toContain('subject="Your code"');
    expect(line).toContain("482913");
  });

  it("sends through Resend when configured", async () => {
    settings = {
      ...settings,
      resendApiKey: "re_test",
      from: "Morrow <hi@example.com>",
    };
    send.mockResolvedValue({ data: { id: "1" }, error: null });
    await sendOtpEmail("user@example.com", "Your code", {
      otp: "482913",
      copy: enUS.emails.otp,
      requestCopy: enUS.emails.requestDetails,
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Morrow <hi@example.com>",
        to: "user@example.com",
        subject: "Your code",
      }),
    );
    expect(send.mock.calls[0]?.[0].html).toContain("482913");
  });

  it("throws for invitation emails when Resend rejects, without leaking details", async () => {
    settings = { ...settings, resendApiKey: "re_test", from: "hi@example.com" };
    send.mockResolvedValue({
      data: null,
      error: {
        name: "validation_error",
        statusCode: 422,
        message: "bad to@x.com",
      },
    });
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      sendWorkspaceInvitationEmail("to@x.com", "Invite", {
        inviterEmail: "a@b.com",
        inviterName: "A",
        workspaceName: "W",
        invitationLink: "http://x",
      } as never),
    ).rejects.toThrow();
    expect(JSON.stringify(errors.mock.calls)).not.toContain("bad to@x.com");
  });

  it("refuses to log emails in production unless opted in", async () => {
    settings = { ...settings, isProduction: true };
    await expect(
      sendOtpEmail("user@example.com", "Your code", {
        otp: "482913",
        copy: enUS.emails.otp,
        requestCopy: enUS.emails.requestDetails,
      }),
    ).rejects.toThrow("Email is not configured");
    expect(send).not.toHaveBeenCalled();

    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    settings = { ...settings, consoleOnly: true };
    await sendOtpEmail("user@example.com", "Your code", {
      otp: "482913",
      copy: enUS.emails.otp,
      requestCopy: enUS.emails.requestDetails,
    });
    expect(String(info.mock.calls[0]?.[0])).toContain("482913");
  });
});
