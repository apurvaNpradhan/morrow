import { shapeSchemaVersion } from "@morrow/sync-schemas";
import type { ZodObject } from "zod";
import { persistedCollectionOptions } from "@tanstack/browser-db-sqlite-persistence";
import { localPersistence, restoresFromLocal } from "./local-database";

/**
 * Keeps a synced collection's rows in the browser's database, so a reload
 * restores them and Electric resumes from its stored offset. Wraps the whole
 * options of `electricCollectionOptions`; without OPFS they pass through as
 * they are.
 *
 * The cache version comes from the Shape's columns: a changed column discards
 * only this collection's local copy. An eager collection of a database that a
 * user had filled renders from it at once instead of waiting for the network;
 * an on-demand one (tasks) loads each live query's rows from SQLite first.
 */
export function persistedShape<Options extends { syncMode?: string }>(
  shape: { name: string; schema: ZodObject },
  options: Options,
): Options {
  if (!localPersistence) return options;
  return persistedCollectionOptions({
    ...options,
    persistence: localPersistence,
    schemaVersion: shapeSchemaVersion(shape),
    ...(restoresFromLocal &&
      options.syncMode !== "on-demand" && {
        initialRender: { strategy: "network-first", networkTimeoutMs: 0 },
      }),
  } as never) as never;
}
