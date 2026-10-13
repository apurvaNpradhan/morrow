import { eq } from "drizzle-orm";
import { expect } from "vite-plus/test";
import { db, schema } from "../../../apps/api/src/platform/database";
import { signInWithOtp } from "./otp";
import type { createApp } from "../../../apps/api/src/index";

type App = ReturnType<typeof createApp>["app"];

function collectCookies(response: Response) {
  const jar = new Map<string, string>();
  for (const setCookie of response.headers.getSetCookie()) {
    const [pair] = setCookie.split(";");
    const [name, ...value] = (pair ?? "").split("=");
    if (!name || value.join("=") === "") continue;
    jar.set(name, value.join("="));
  }
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

export async function signUpWithSession(
  app: App,
  {
    email,
    name,
    role,
  }: { email: string; name: string; role?: "admin" | "user" },
) {
  const response = await signInWithOtp(
    (path, body) =>
      app.request(`/api/auth${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    email,
    { name },
  );
  expect(response.status).toBe(200);
  const cookies = collectCookies(response);
  const { user } = (await response.json()) as { user: { id: string } };

  if (role) {
    await db
      .update(schema.userTable)
      .set({ role })
      .where(eq(schema.userTable.id, user.id));
  }

  return { userId: user.id, cookies };
}
