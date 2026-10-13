import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { config } from "./config";

afterEach(() => vi.unstubAllEnvs());

describe("config", () => {
  it("parses booleans and numbers, with schema defaults when unset", () => {
    vi.stubEnv("REGISTRATION_OPEN", "false");
    vi.stubEnv("MAX_WORKSPACES_PER_USER", "7");
    expect(config.registrationOpen).toBe(false);
    expect(config.maxWorkspacesPerUser).toBe(7);

    vi.stubEnv("REGISTRATION_OPEN", "");
    vi.stubEnv("MAX_WORKSPACES_PER_USER", "");
    expect(config.registrationOpen).toBe(true);
    expect(config.maxWorkspacesPerUser).toBe(3);
  });

  it("derives the API URL from the client URL", () => {
    vi.stubEnv("MORROW_CLIENT_URL", "https://morrow.example.com");
    vi.stubEnv("MORROW_API_URL", "");
    expect(config.apiUrl).toBe("https://morrow.example.com/api");
  });

  it("has no client URL default in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MORROW_CLIENT_URL", "");
    expect(config.clientUrl).toBe("");
  });

  it("reads email settings, including the console opt-in", () => {
    vi.stubEnv("RESEND_API_KEY", "re_key");
    vi.stubEnv("EMAIL_FROM", "Morrow <hi@example.com>");
    vi.stubEnv("MORROW_EMAIL_CONSOLE", "true");
    expect(config.email).toMatchObject({
      resendApiKey: "re_key",
      from: "Morrow <hi@example.com>",
      consoleOnly: true,
    });
  });
});
