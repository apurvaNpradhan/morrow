import type { QueryClient } from "@tanstack/react-query";

const ORPC_PRIVATE_ROOTS = new Set(["activity"]);

/** oRPC keys look like [["activity", "list"], { input }]. */
function isPrivateOrpcQuery(queryKey: readonly unknown[]) {
  const path = queryKey[0];
  return Array.isArray(path) && ORPC_PRIVATE_ROOTS.has(String(path[0]));
}

export function evictWorkspaceCache(client: QueryClient, workspaceId: string) {
  evictPrivateQueries(client, workspaceId);
}

export function evictInaccessibleWorkspaceCache(
  client: QueryClient,
  workspaceIds: string[],
) {
  evictPrivateQueries(client, undefined, new Set(workspaceIds));
}

function evictPrivateQueries(
  client: QueryClient,
  workspaceId?: string,
  allowed?: Set<string>,
) {
  const queries = client.getQueryCache().getAll();
  const ids = new Set<string>(workspaceId ? [workspaceId] : []);
  const scopes = new Map<string, string>(
    Array.from(allowed ?? [], (id) => [id, id]),
  );
  const visit = (
    value: unknown,
    callback: (record: Record<string, unknown>) => void,
  ) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, callback);
      return;
    }
    const record = value as Record<string, unknown>;
    callback(record);
    for (const item of Object.values(record)) visit(item, callback);
  };
  for (const query of queries)
    visit(query.state.data, (record) => {
      if (typeof record.workspaceId === "string")
        scopes.set(record.workspaceId, record.workspaceId);
      if (
        typeof record.workspaceId === "string" &&
        typeof record.id === "string"
      )
        scopes.set(record.id, record.workspaceId);
      if (
        typeof record.workspaceId === "string" &&
        (allowed
          ? !allowed.has(record.workspaceId)
          : record.workspaceId === workspaceId) &&
        typeof record.id === "string"
      )
        ids.add(record.id);
    });
  const predicate = (query: (typeof queries)[number]) => {
    if (isPrivateOrpcQuery(query.queryKey)) return true;
    let affected = false;
    visit([query.queryKey, query.state.data], (record) => {
      if (
        (allowed &&
          typeof record.workspaceId === "string" &&
          !allowed.has(record.workspaceId)) ||
        Object.values(record).some(
          (value) => typeof value === "string" && ids.has(value),
        )
      )
        affected = true;
    });
    let knownOtherWorkspace = query.queryKey.some(
      (value) =>
        typeof value === "string" &&
        scopes.has(value) &&
        (allowed
          ? allowed.has(scopes.get(value)!)
          : scopes.get(value) !== workspaceId),
    );
    if (
      query.queryKey[0] === "workspace" &&
      typeof query.queryKey[1] === "string"
    ) {
      knownOtherWorkspace = allowed
        ? allowed.has(query.queryKey[1])
        : query.queryKey[1] !== workspaceId;
    }
    if (
      query.queryKey[0] === "workspace-metadata" &&
      typeof query.queryKey[1] === "string"
    ) {
      knownOtherWorkspace = allowed
        ? allowed.has(query.queryKey[1])
        : query.queryKey[1] !== workspaceId;
    }
    visit(query.queryKey, (record) => {
      if (
        typeof record.workspaceId === "string" &&
        (allowed
          ? allowed.has(record.workspaceId)
          : record.workspaceId !== workspaceId)
      )
        knownOtherWorkspace = true;
      if (
        Object.values(record).some(
          (value) =>
            typeof value === "string" &&
            scopes.has(value) &&
            (allowed
              ? allowed.has(scopes.get(value)!)
              : scopes.get(value) !== workspaceId),
        )
      )
        knownOtherWorkspace = true;
    });
    const privatePrefixes = new Set([
      "active-organization",
      "workspace-users",
      "workspace-user",
      "active-workspace-users",
      "workspace-roles",
      "workspace-capabilities",
      "workspace-invites",
      "workspace",
      "workspace-metadata",
      "workspaces",
      "members",
      "roles",
      "search",
    ]);
    return (
      (privatePrefixes.has(String(query.queryKey[0])) &&
        !knownOtherWorkspace) ||
      affected ||
      query.queryKey.some(
        (value) => typeof value === "string" && ids.has(value),
      )
    );
  };
  void client.cancelQueries({ predicate });
  // Keep active observers attached: removing their query can strand a board
  // opened concurrently with the access snapshot. Reset and refetch instead.
  client.removeQueries({
    predicate: (query) => predicate(query) && !query.isActive(),
  });
  void client.resetQueries({
    predicate: (query) => predicate(query) && query.isActive(),
  });
}
