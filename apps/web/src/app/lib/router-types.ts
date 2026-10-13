import type { AppRouter } from "@morrow/api";
import type { InferRouterOutputs } from "@orpc/server";

/** What each procedure returns, for typing components. */
export type RouterOutputs = InferRouterOutputs<AppRouter>;
