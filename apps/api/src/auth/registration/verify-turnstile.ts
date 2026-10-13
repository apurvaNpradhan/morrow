import { config } from "#api/platform/config";

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
export type TurnstileResult = { ok: true } | { ok: false; reason: string };

export const authCaptchaPaths = new Set([
  "/sign-in/social",
  "/email-otp/send-verification-otp",
]);

// One token is redeemed at initiation, never again at the OAuth callback or
// OTP redemption. Better Auth verifies the corresponding state/code there.
export async function verifyTurnstile(
  token: unknown,
): Promise<TurnstileResult> {
  const secret = config.turnstileSecretKey;
  if (!secret) return { ok: true };
  const failure = {
    ok: false,
    reason: "Captcha verification failed.",
  } as const;
  if (typeof token !== "string" || token.length === 0 || token.length > 2048)
    return failure;

  try {
    const hostname = new URL(config.clientUrl).hostname;
    if (
      config.isProduction &&
      ["localhost", "127.0.0.1", "[::1]"].includes(hostname)
    )
      return failure;
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body: new URLSearchParams({ secret, response: token }),
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return failure;
    const data: unknown = await response.json();
    if (
      data &&
      typeof data === "object" &&
      "success" in data &&
      data.success === true &&
      "action" in data &&
      data.action === "auth" &&
      "hostname" in data &&
      data.hostname === hostname
    )
      return { ok: true };
  } catch {
    // Fail closed without retaining token, secret or an upstream error body.
  }
  return failure;
}
