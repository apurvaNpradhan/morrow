import { Resend } from "resend";

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/** What the transport needs; the API supplies it from its typed config. */
export type EmailSettings = {
  resendApiKey?: string;
  from?: string;
  /** Log emails instead of sending, even in production (throwaway stacks). */
  consoleOnly: boolean;
  isProduction: boolean;
};

let readSettings = (): EmailSettings => ({
  consoleOnly: false,
  isProduction: false,
});

/** Tells the transport where its settings come from. Read on every send. */
export function configureEmail(read: () => EmailSettings) {
  readSettings = read;
}

// Logging emails is for development and tests. Production must opt in
// explicitly, so a missing API key can never leak links and codes into
// production logs. (Startup validation also requires the key in production.)
function consoleEnabled(settings: EmailSettings) {
  return settings.consoleOnly || !settings.isProduction;
}

// Provider error messages can echo addresses or message content, so only the
// error name and HTTP status are ever logged.
export function describeError(error: unknown) {
  const details = error && typeof error === "object" ? error : {};
  const name = "name" in details ? details.name : undefined;
  const statusCode = "statusCode" in details ? details.statusCode : undefined;
  return {
    name: typeof name === "string" ? name : "UNKNOWN",
    ...(typeof statusCode === "number" ? { statusCode } : {}),
  };
}

// With no API key the email is rendered and written to the console; this is
// how development and tests run. The first line format is stable so tests can
// parse it; the plain-text body follows.
export const CONSOLE_EMAIL_MARKER = "[morrow-email]";

export async function deliver(email: OutgoingEmail): Promise<void> {
  const settings = readSettings();
  const apiKey = settings.resendApiKey;
  if (!apiKey || settings.consoleOnly) {
    if (!consoleEnabled(settings)) {
      throw Object.assign(new Error("Email is not configured"), {
        name: "EMAIL_NOT_CONFIGURED",
      });
    }
    console.info(
      `${CONSOLE_EMAIL_MARKER} to=${email.to} subject=${JSON.stringify(email.subject)}\n${email.text}`,
    );
    return;
  }

  const from = settings.from;
  if (!from) {
    throw Object.assign(new Error("EMAIL_FROM is not set"), {
      name: "EMAIL_FROM_MISSING",
    });
  }

  const { error } = await new Resend(apiKey).emails.send({
    from,
    to: email.to,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
  if (error) {
    throw Object.assign(new Error("Resend rejected the email"), {
      name: error.name,
      statusCode: error.statusCode ?? undefined,
    });
  }
}
