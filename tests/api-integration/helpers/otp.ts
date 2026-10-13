import { eq } from "drizzle-orm";
import { db, schema } from "../../../apps/api/src/platform/database";

type Post = (
  path: string,
  body: unknown,
  headers?: Record<string, string>,
) => Promise<Response>;

/** Reads the pending sign-in code straight from Better Auth's verification row (stored plain). */
export async function readSignInOtp(email: string) {
  const [row] = await db
    .select()
    .from(schema.verificationTable)
    .where(eq(schema.verificationTable.identifier, `sign-in-otp-${email}`));
  return row?.value.split(":")[0] ?? "";
}

/**
 * Creates an account (or signs in) the way users do: request an emailed code,
 * then redeem it. Returns the sign-in response, or the rejected send response.
 */
export async function signInWithOtp(
  post: Post,
  email: string,
  options: { name?: string; headers?: Record<string, string> } = {},
) {
  const sent = await post(
    "/email-otp/send-verification-otp",
    { email, type: "sign-in" },
    options.headers,
  );
  if (sent.status !== 200) return sent;
  return post(
    "/sign-in/email-otp",
    { email, otp: await readSignInOtp(email), name: options.name },
    options.headers,
  );
}
