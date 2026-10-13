import { APIError } from "better-auth/api";
import { isAdminEmail } from "#api/auth/access/admin-allowlist";
import { checkRegistrationAllowed } from "./check-registration-allowed";

export function normalizeInvitationId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return /^[a-z0-9_-]{1,128}$/i.test(normalized) ? normalized : undefined;
}

export function isOAuthCallbackPath(path: unknown): boolean {
  return (
    typeof path === "string" &&
    (path.startsWith("/callback/") || path.startsWith("/oauth2/callback/"))
  );
}

export async function assertUserRegistrationAllowed(
  user: {
    email: string;
    emailVerified?: boolean;
  },
  context?: { path?: string; invitationId?: unknown },
): Promise<void> {
  // The owner can always sign up, even with registration closed.
  if (user.emailVerified === true && isAdminEmail(user.email, true)) return;
  const verifiedEmailFlow =
    isOAuthCallbackPath(context?.path) ||
    context?.path === "/sign-in/email-otp";
  const result = await checkRegistrationAllowed(
    user.email,
    normalizeInvitationId(context?.invitationId),
    {
      allowInvitationByEmail: verifiedEmailFlow,
      emailVerified: user.emailVerified === true,
    },
  );
  if (!result.allowed)
    throw new APIError("FORBIDDEN", { message: result.reason });
}
