export type WorkspaceCreationPolicy = {
  limit: number;
  isInstanceAdmin: boolean;
  owned: number;
};

export type WorkspaceCreationDecision =
  | { allowed: true; reason: null }
  | { allowed: false; reason: "limit" };

/** Instance admins bypass the limit. */
export function decideWorkspaceCreation(
  policy: WorkspaceCreationPolicy,
): WorkspaceCreationDecision {
  if (policy.isInstanceAdmin) return { allowed: true, reason: null };
  if (policy.owned >= policy.limit) return { allowed: false, reason: "limit" };
  return { allowed: true, reason: null };
}
