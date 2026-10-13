import { expect } from "vite-plus/test";
import type { createApp } from "../../../apps/api/src/index";
import { createTestClient } from "./orpc";
import { signInWithOtp } from "./otp";

const origin = "http://localhost:5173";

/**
 * Signs a real user in the way people do (emailed code, then redeem it) and
 * returns a typed client that acts as them through a real session cookie.
 */
export async function signUpUser(
  app: ReturnType<typeof createApp>["app"],
  address: string,
) {
  const post = (
    path: string,
    body: unknown,
    headers?: Record<string, string>,
  ) =>
    app.request(`/api/auth${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Origin: origin,
        Cookie: headers?.cookie ?? "",
      },
      body: JSON.stringify(body),
    });
  const result = await signInWithOtp(post, address, {
    name: address.split("@")[0],
  });
  expect(result.status).toBe(200);
  const body = await result.json();
  const cookie = result.headers
    .getSetCookie()
    .map((entry) => entry.split(";")[0])
    .join("; ");
  return {
    id: body.user.id as string,
    email: address,
    cookie,
    client: createTestClient(app, { cookie }),
  };
}
