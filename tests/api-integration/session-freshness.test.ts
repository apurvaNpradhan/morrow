import { beforeEach, describe, expect, it } from "vite-plus/test";
import { createApp } from "../../apps/api/src/index";
import { resetTestDatabase } from "./helpers/database";
import { signInWithOtp } from "./helpers/otp";

type SessionResponse = { user: { image: string | null; name: string } } | null;

function applyCookies(existing: string, response: Response) {
  const jar = new Map<string, string>();

  for (const pair of existing.split("; ").filter(Boolean)) {
    const [name, ...value] = pair.split("=");
    if (name) jar.set(name, value.join("="));
  }

  for (const setCookie of response.headers.getSetCookie()) {
    const [pair] = setCookie.split(";");
    const [name, ...value] = (pair ?? "").split("=");
    if (!name) continue;
    if (value.join("=") === "") {
      jar.delete(name);
      continue;
    }
    jar.set(name, value.join("="));
  }

  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

function collectCookies(response: Response) {
  return applyCookies("", response);
}

async function signUp(app: ReturnType<typeof createApp>["app"]) {
  const response = await signInWithOtp(
    (path, body) =>
      app.request(`/api/auth${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    "avatar-session@example.com",
    { name: "Avatar Session" },
  );

  expect(response.status).toBe(200);
  const cookies = collectCookies(response);
  expect(cookies).not.toBe("");

  return cookies;
}

describe("API integration: session freshness after profile updates", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("serves the updated user with and without a cookie-cache bypass", async () => {
    const { app } = createApp();
    const cookies = await signUp(app);

    const update = await app.request("/api/auth/update-user", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookies },
      body: JSON.stringify({ name: "Fresh Name" }),
    });
    expect(update.status).toBe(200);

    const current = (await (
      await app.request("/api/auth/get-session", {
        headers: { cookie: cookies },
      })
    ).json()) as SessionResponse;
    expect(current?.user.name).toBe("Fresh Name");

    const fresh = (await (
      await app.request("/api/auth/get-session?disableCookieCache=true", {
        headers: { cookie: cookies },
      })
    ).json()) as SessionResponse;
    expect(fresh?.user.name).toBe("Fresh Name");
  });

  it("keeps profile changes fresh without issuing session-data cookies", async () => {
    const { app } = createApp();
    const cookies = await signUp(app);

    await app.request("/api/auth/update-user", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookies },
      body: JSON.stringify({ name: "Renamed User" }),
    });

    const refreshed = await app.request(
      "/api/auth/get-session?disableCookieCache=true",
      {
        headers: { cookie: cookies },
      },
    );

    expect(
      refreshed.headers
        .getSetCookie()
        .some((cookie) => cookie.includes("session_data=")),
    ).toBe(false);

    const nextCookies = applyCookies(cookies, refreshed);
    const current = (await (
      await app.request("/api/auth/get-session", {
        headers: { cookie: nextCookies },
      })
    ).json()) as SessionResponse;

    expect(current?.user.name).toBe("Renamed User");
  });
});
