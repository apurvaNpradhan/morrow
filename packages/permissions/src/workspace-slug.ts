import { z } from "zod";

export const WORKSPACE_SLUG_MIN_LENGTH = 3;
export const WORKSPACE_SLUG_MAX_LENGTH = 40;

/** Words that would collide with top-level routes, API paths or static folders beside `/$slug`. */
export const RESERVED_WORKSPACE_SLUGS: readonly string[] = [
  "new",
  "settings",
  "admin",
  "auth",
  "invitation",
  "mcp",
  "onboarding",
  "privacy",
  "test-error",
  "api",
  "rpc",
  "assets",
  "images",
];

export type WorkspaceSlugIssue = "invalid" | "reserved";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isReservedWorkspaceSlug(slug: string): boolean {
  return RESERVED_WORKSPACE_SLUGS.includes(slug);
}

/** Format rules only; reserved words are reported separately by `getSlugIssue`. */
export const workspaceSlugSchema = z
  .string()
  .min(WORKSPACE_SLUG_MIN_LENGTH)
  .max(WORKSPACE_SLUG_MAX_LENGTH)
  .regex(SLUG_PATTERN);

/** Why a slug can't be used, or null when it is well-formed and not reserved. */
export function getSlugIssue(slug: string): WorkspaceSlugIssue | null {
  if (!workspaceSlugSchema.safeParse(slug).success) return "invalid";
  return isReservedWorkspaceSlug(slug) ? "reserved" : null;
}

/** Suggests a slug from a workspace name. Never adds suffixes; may return "". */
export function createDefaultSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, WORKSPACE_SLUG_MAX_LENGTH)
    .replace(/-+$/, "");
}
