import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { expect, it } from "vite-plus/test";
import {
  evictInaccessibleWorkspaceCache,
  evictWorkspaceCache,
} from "./evict-workspace-cache";

it("evicts revoked workspace data while preserving another workspace", () => {
  const client = new QueryClient();
  const active = { id: "active", name: "Active workspace" };
  client.setQueryData(["workspace", "active"], active);
  client.setQueryData(["workspace-metadata", "active"], active);
  client.setQueryData(["workspace", "revoked"], {
    id: "revoked",
    name: "Private workspace",
  });
  client.setQueryData(["workspace-metadata", "revoked"], {
    id: "revoked",
    name: "Private workspace",
  });
  client.setQueryData(
    ["workspace-roles", "revoked"],
    [{ id: "member-1", workspaceId: "revoked" }],
  );
  client.setQueryData(
    [["activity", "list"], {}],
    [{ id: "activity-1", workspaceId: "revoked" }],
  );

  evictWorkspaceCache(client, "revoked");

  expect(client.getQueryData(["workspace", "active"])).toEqual(active);
  expect(client.getQueryData(["workspace-metadata", "active"])).toEqual(active);
  expect(client.getQueryData(["workspace", "revoked"])).toBeUndefined();
  expect(
    client.getQueryData(["workspace-metadata", "revoked"]),
  ).toBeUndefined();
  expect(client.getQueryData(["workspace-roles", "revoked"])).toBeUndefined();
  expect(client.getQueryData([["activity", "list"], {}])).toBeUndefined();
  client.clear();
});

it("cancels an unscoped member query when workspace access is revoked", async () => {
  const client = new QueryClient();
  let finish!: (value: unknown) => void;
  const pending = client.fetchQuery({
    queryKey: ["workspace-roles", "unknown"],
    queryFn: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });

  evictWorkspaceCache(client, "revoked");
  finish([{ id: "member-1", workspaceId: "revoked" }]);
  await pending.catch(() => undefined);
  expect(client.getQueryData(["workspace-roles", "unknown"])).toBeUndefined();
  client.clear();
});

it("reconciles missed revocations against a reconnect access snapshot", () => {
  const client = new QueryClient();
  const active = { id: "active", name: "Active workspace" };
  client.setQueryData(["workspace", "active"], active);
  client.setQueryData(["workspace-metadata", "active"], active);
  client.setQueryData(["workspace", "revoked"], {
    id: "revoked",
    name: "Private workspace",
  });
  client.setQueryData(["workspace-metadata", "revoked"], {
    id: "revoked",
    name: "Private workspace",
  });
  client.setQueryData(
    ["workspace-roles", "revoked"],
    [{ id: "member-1", workspaceId: "revoked" }],
  );

  evictInaccessibleWorkspaceCache(client, ["active"]);

  expect(client.getQueryData(["workspace", "active"])).toEqual(active);
  expect(client.getQueryData(["workspace-metadata", "active"])).toEqual(active);
  expect(client.getQueryData(["workspace", "revoked"])).toBeUndefined();
  expect(
    client.getQueryData(["workspace-metadata", "revoked"]),
  ).toBeUndefined();
  expect(client.getQueryData(["workspace-roles", "revoked"])).toBeUndefined();
  client.clear();
});

it("refetches an active member query whose pending response has no scope yet", async () => {
  const client = new QueryClient();
  let finishOld!: (value: unknown) => void;
  let reads = 0;
  const options = {
    queryKey: ["workspace-roles", "unknown"],
    staleTime: Infinity,
    retry: false,
    queryFn: () => {
      reads++;
      return reads === 1
        ? new Promise<unknown>((resolve) => {
            finishOld = resolve;
          })
        : Promise.resolve([{ id: "member-2", workspaceId: "active" }]);
    },
  };
  const observer = new QueryObserver(client, options);
  const unsubscribe = observer.subscribe(() => {});
  expect(reads).toBe(1);
  evictInaccessibleWorkspaceCache(client, ["active"]);
  finishOld([{ id: "member-1", workspaceId: "revoked" }]);
  await client.fetchQuery(options);
  expect(reads).toBe(2);
  expect(observer.getCurrentResult().data).toEqual([
    { id: "member-2", workspaceId: "active" },
  ]);
  unsubscribe();
  client.clear();
});

it.each(["revocation", "snapshot"])(
  "preserves nested workspace-scoped member keys during %s",
  (kind) => {
    const client = new QueryClient();
    const allowedKey = ["workspace-roles", { workspaceId: "allowed" }];
    const revokedKey = ["workspace-roles", { workspaceId: "revoked" }];
    client.setQueryData(allowedKey, [{ id: "member-1" }]);
    client.setQueryData(revokedKey, [{ id: "member-2" }]);

    if (kind === "revocation") evictWorkspaceCache(client, "revoked");
    else evictInaccessibleWorkspaceCache(client, ["allowed"]);

    expect(client.getQueryData(allowedKey)).toEqual([{ id: "member-1" }]);
    expect(client.getQueryData(revokedKey)).toBeUndefined();
    client.clear();
  },
);
