import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { AppRouter } from "@morrow/api";
import type { RouterClient } from "@orpc/server";
import { env } from "./env";

const link = new RPCLink({
  origin: new URL(env.apiOrigin).origin,
  url: "/rpc",
  fetch: (input, init) => fetch(input, { ...init, credentials: "include" }),
});

/** Typed client for the API's procedures. */
export const rpc: RouterClient<AppRouter> = createORPCClient(link);

/** Query and mutation options and keys for every procedure. */
export const orpc = createTanstackQueryUtils(rpc);
