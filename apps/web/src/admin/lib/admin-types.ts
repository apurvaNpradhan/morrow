import type { RouterOutputs } from "@/app/lib/router-types";

export const ADMIN_USERS_PAGE_SIZE = 20;
export const ADMIN_USERS_SEARCH_MAX_LENGTH = 200;
export const ADMIN_WORKSPACES_PAGE_SIZE = 20;
export const ADMIN_WORKSPACES_SEARCH_MAX_LENGTH = 200;

export type AdminUser =
  RouterOutputs["admin"]["users"]["list"]["users"][number];

export type AdminWorkspace =
  RouterOutputs["admin"]["workspaces"]["list"]["workspaces"][number];

export type AdminWorkspaceMember =
  RouterOutputs["admin"]["workspaces"]["members"][number];
