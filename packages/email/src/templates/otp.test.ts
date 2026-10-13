import { render } from "@react-email/render";
import { createElement } from "react";
import { describe, expect, it } from "vite-plus/test";
import enUS from "@morrow/i18n/en-US.json";
import { OTP_EXPIRY_SECONDS } from "../otp-expiry";
import OtpEmail from "./otp";

const props = {
  otp: "123456",
  copy: enUS.emails.otp,
  requestCopy: enUS.emails.requestDetails,
};

describe("OtpEmail", () => {
  it("renders the verification code with the i18n copy", async () => {
    expect(OTP_EXPIRY_SECONDS).toBe(300);
    const html = await render(createElement(OtpEmail, props));
    expect(html).toContain("123456");
    expect(html).toContain("verification code");
    expect(html).toContain("This code expires in 5 minutes.");
    expect(html).toContain("Morrow security email");
  });

  it("says who asked, from where and when, so a stranger's attempt stands out", async () => {
    const html = await render(
      createElement(OtpEmail, {
        ...props,
        email: "maya@example.com",
        instanceUrl: "https://morrow.example.com",
        requestedAt: "2026-10-11T14:12:00.000Z",
        device: { browser: "Safari", os: "iPhone" },
      }),
    );
    expect(html).toContain("maya@example.com");
    expect(html).toContain("morrow.example.com");
    expect(html).toContain("Safari on iPhone");
    expect(html).toContain("UTC");
    expect(html).toContain("https://morrow.example.com/privacy");
  });

  it("omits the details frame when the request is unknown", async () => {
    const html = await render(createElement(OtpEmail, props));
    expect(html).not.toContain("Request details");
  });

  it("ships a dark theme and the language of the document", async () => {
    const html = await render(createElement(OtpEmail, props));
    expect(html).toContain("prefers-color-scheme: dark");
    expect(html).toContain('lang="en"');
  });
});
