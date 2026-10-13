import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { auth } from "../../apps/api/src/auth/config";
import { createApp } from "../../apps/api/src/index";
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
    headers: {
      "content-type": "application/json",
      Origin: origin,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function sendCode(email: string) {
  return post("/email-otp/send-verification-otp", { email, type: "sign-in" });
}

beforeEach(resetTestDatabase);
afterEach(async () => {
  vi.unstubAllEnvs();
  (await auth.$context).rateLimit.enabled = false;
});

describe("email verification", () => {
  it("creates a verified account when the emailed code is redeemed", async () => {
    const response = await signInWithOtp(post, "verified@example.com", {
      name: "Verified",
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("session_token");
    const { user } = await response.json();
    expect(user.emailVerified).toBe(true);
  });

  it("rejects a wrong code", async () => {
    await sendCode("wrong@example.com");
    const response = await post("/sign-in/email-otp", {
      email: "wrong@example.com",
      otp: "000000",
    });
    expect(response.status).toBe(400);
  });
});

describe("auth rate limiting", () => {
  it("answers 429 once a client exceeds the code request limit", async () => {
    // Counters live in process memory and are shared by every test (the app
    // sees no client IP here), so only this test switches limiting on.
    (await auth.$context).rateLimit.enabled = true;
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 5; attempt++) {
      statuses.push((await sendCode(`rate${attempt}@example.com`)).status);
    }
    expect(statuses.slice(0, 3)).toEqual([200, 200, 200]);
    expect(statuses.slice(3)).toEqual([429, 429]);
  });
});

describe("captcha", () => {
  it("is required on code requests when Turnstile is configured and off otherwise", async () => {
    expect((await sendCode("nocaptcha@example.com")).status).toBe(200);
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    expect((await sendCode("captcha@example.com")).status).toBe(403);
  });
});
