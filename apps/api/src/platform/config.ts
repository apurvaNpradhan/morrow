/**
 * The API's typed view of its configuration. `.env.schema` at the repo root is
 * the one declaration of every variable; `varlock run` validates it before the
 * process starts (the API refuses to boot on a missing or malformed value),
 * redacts @sensitive values from logs, and loads the values into the process
 * environment. This module is the only reader of that environment, so values
 * are parsed once, here, and typed everywhere else. Getters read at call time,
 * which lets tests change a value for one case.
 *
 * Names are checked against the schema through the generated `env.d.ts`.
 * The few defaults below only apply when the API runs without varlock, as in
 * tests.
 */

import type { EnvSchemaAsStrings } from "../../../../env.d";

type EnvName = keyof EnvSchemaAsStrings;

function text(name: EnvName): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function flag(name: EnvName, fallback: boolean): boolean {
  const value = text(name);
  return value === undefined ? fallback : value.toLowerCase() === "true";
}

function whole(name: EnvName, fallback: number): number {
  const parsed = Number.parseInt(text(name) ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function fraction(name: EnvName): number {
  const parsed = Number(text(name));
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0;
}

export const config = {
  get nodeEnv() {
    return text("NODE_ENV") ?? "development";
  },
  /** Only when NODE_ENV is set to it: the default must not enable dev-only output. */
  get isDevelopment() {
    return text("NODE_ENV") === "development";
  },
  get isProduction() {
    return this.nodeEnv === "production";
  },

  get clientUrl() {
    // Production has no default: startup validation requires it.
    return (
      text("MORROW_CLIENT_URL") ??
      (this.isProduction ? "" : "http://localhost:5173")
    );
  },
  get apiUrl() {
    return text("MORROW_API_URL") ?? `${this.clientUrl}/api`;
  },
  get trustedProxies() {
    return text("TRUSTED_PROXIES");
  },

  get databaseUrl() {
    return text("DATABASE_URL") ?? "postgresql://morrow@localhost:5432/morrow";
  },

  get electric() {
    return {
      url: text("ELECTRIC_URL") ?? "http://127.0.0.1:3010",
      secret: text("ELECTRIC_SECRET") ?? "",
    };
  },

  get durableStreamsUrl() {
    return text("DURABLE_STREAMS_URL") ?? "http://127.0.0.1:4437";
  },

  get authSecret() {
    return process.env.AUTH_SECRET;
  },
  get adminEmails() {
    return text("ADMIN_EMAILS");
  },
  get registrationOpen() {
    return flag("REGISTRATION_OPEN", true);
  },
  get maxWorkspacesPerUser() {
    return whole("MAX_WORKSPACES_PER_USER", 3);
  },
  get google() {
    return {
      clientId: text("GOOGLE_CLIENT_ID") ?? "",
      clientSecret: text("GOOGLE_CLIENT_SECRET") ?? "",
    };
  },
  get github() {
    return {
      clientId: text("GITHUB_CLIENT_ID") ?? "",
      clientSecret: text("GITHUB_CLIENT_SECRET") ?? "",
    };
  },
  get turnstileSecretKey() {
    return text("TURNSTILE_SECRET_KEY");
  },

  get email() {
    return {
      resendApiKey: text("RESEND_API_KEY"),
      from: text("EMAIL_FROM"),
      consoleOnly: flag("MORROW_EMAIL_CONSOLE", false),
      isProduction: this.isProduction,
    };
  },

  get s3() {
    return {
      endpoint: text("S3_ENDPOINT") ?? "",
      bucket: text("S3_BUCKET") ?? "",
      accessKeyId: text("S3_ACCESS_KEY_ID") ?? "",
      secretAccessKey: text("S3_SECRET_ACCESS_KEY") ?? "",
      region: text("S3_REGION") ?? "us-east-1",
      publicBaseUrl: text("S3_PUBLIC_BASE_URL"),
      keyPrefix: text("S3_KEY_PREFIX") ?? "",
      forcePathStyle: flag("S3_FORCE_PATH_STYLE", true),
      presignTtlSeconds: whole("S3_PRESIGN_TTL_SECONDS", 300),
    };
  },

  get sentry() {
    return {
      dsn: text("SENTRY_DSN"),
      environment: text("SENTRY_ENVIRONMENT") ?? this.nodeEnv,
      release: text("SENTRY_RELEASE"),
      tracesSampleRate: fraction("SENTRY_TRACES_SAMPLE_RATE"),
      profilesSampleRate: fraction("SENTRY_PROFILES_SAMPLE_RATE"),
    };
  },
};
