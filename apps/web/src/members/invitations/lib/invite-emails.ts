import { z } from "zod/v4";

const emailSchema = z.email();

export type ParsedInviteEmails =
  | { ok: true; emails: string[] }
  | { ok: false; invalidIndexes: number[] };

export function parseInviteEmails(values: string[]): ParsedInviteEmails {
  const filled = values.flatMap((value, index) => {
    const email = value.trim();
    return email ? [{ email, index }] : [];
  });

  const invalidIndexes = filled.flatMap(({ email, index }) =>
    emailSchema.safeParse(email).success ? [] : [index],
  );

  if (invalidIndexes.length > 0) {
    return { ok: false, invalidIndexes };
  }

  return {
    ok: true,
    emails: [...new Set(filled.map(({ email }) => email.toLowerCase()))],
  };
}
