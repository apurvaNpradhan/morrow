import { AsyncLocalStorage } from "node:async_hooks";

/** The verified user behind the current request, so activity records who caused it. */
export const eventContext = new AsyncLocalStorage<{
  actorUserId: string;
}>();
