import type { RouterOutputs } from "@/app/lib/router-types";

/** One of the caller's workspaces, as listed in the switcher. */
export type WorkspaceSummary = RouterOutputs["workspace"]["list"][number];
