import { describe, expect, it } from "vite-plus/test";
import { createApp } from "../../apps/api/src/index";

const { app } = createApp();

function rpc(path: string, init: RequestInit & { headers?: HeadersInit } = {}) {
  return app.request(path, { method: "POST", ...init });
}

describe("/rpc request boundaries", () => {
  it("refuses oversized bodies on every procedure, with or without a trailing slash", async () => {
    const body = new Uint8Array(2 * 1024 * 1024);
    for (const path of [
      "/rpc/auth/registrationStatus",
      "/rpc/account/uploadAvatar/",
      "/rpc/workspace/uploadLogo",
    ]) {
      const response = await rpc(path, {
        body,
        headers: { "content-type": "application/json" },
      });
      expect(response.status).toBe(413);
    }
  });

  it("refuses browser requests from other origins, including the realtime stream", async () => {
    for (const origin of ["https://evil.example", "null"]) {
      const response = await rpc("/rpc/realtime/subscribe", {
        body: "{}",
        headers: { "content-type": "application/json", origin },
      });
      expect(response.status).toBe(403);
    }
  });
});
