import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { createApp } from "../../apps/api/src/index";
import { createTestClient } from "./helpers/orpc";

describe("API integration: registration status", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["false", false],
    ["true", true],
    [undefined, true],
  ])("reports open for REGISTRATION_OPEN=%s", async (value, open) => {
    vi.stubEnv("REGISTRATION_OPEN", value);
    const client = createTestClient(createApp().app);
    expect(await client.auth.registrationStatus()).toEqual({ open });
  });
});
