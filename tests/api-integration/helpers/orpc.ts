import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import type { AppRouter } from "../../../apps/api/src/platform/orpc/router";
import type { createApp } from "../../../apps/api/src/index";

/**
 * A typed client whose requests go through the real Hono app in-process, so
 * every call passes the session lookup, oRPC validation and the database.
 */
export function createTestClient(
  app: ReturnType<typeof createApp>["app"],
  headers: Record<string, string> = {},
): RouterClient<AppRouter> {
  const link = new RPCLink({
    origin: "http://localhost",
    url: "/rpc",
    headers: () => headers,
    fetch: (input, init) => app.fetch(new Request(input, init)),
  });
  return createORPCClient(link);
}
