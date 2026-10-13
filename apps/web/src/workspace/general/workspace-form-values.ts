export type WorkspaceFormValues = {
  name: string;
  description?: string;
};

export type NormalizedWorkspaceValues = {
  name: string;
  description: string;
};

export function normalizeWorkspaceValues(
  data: WorkspaceFormValues,
): NormalizedWorkspaceValues {
  return {
    name: data.name.trim(),
    description: (data.description ?? "").trim(),
  };
}

/** Better Auth persists description as an organization additional field (DB column), not only inside metadata. */
export function getWorkspaceDescription(
  workspace:
    | { description?: string | null; metadata?: unknown }
    | null
    | undefined,
): string {
  if (!workspace) return "";
  if (typeof workspace.description === "string") {
    return workspace.description;
  }
  if (
    typeof workspace.metadata === "object" &&
    workspace.metadata &&
    "description" in workspace.metadata
  ) {
    return String(
      (workspace.metadata as { description?: unknown }).description ?? "",
    );
  }
  return "";
}
