import * as Sentry from "@sentry/react";
import {
  BrowserCollectionCoordinator,
  createBrowserWASQLitePersistence,
  openBrowserWASQLiteOPFSDatabase,
  type BrowserWASQLiteDatabase,
  type PersistedCollectionPersistence,
} from "@tanstack/browser-db-sqlite-persistence";
import { OWNER_STAMP_KEY, readOwnerStamp } from "./owner-stamp";

const DATABASE_NAME = "morrow-sync";
// OPFS opens in milliseconds; a stuck open must not hold the app's boot.
const OPEN_TIMEOUT_MS = 5_000;

/** Removes the database file and its journals from OPFS. */
async function deleteDatabaseFile() {
  if (typeof navigator.storage?.getDirectory !== "function") return;
  try {
    const root = await navigator.storage.getDirectory();
    for await (const name of root.keys()) {
      // Another tab may still hold the file; its wipe or the next boot ends the job.
      if (name.startsWith(DATABASE_NAME)) {
        await root.removeEntry(name, { recursive: true });
      }
    }
  } catch (error) {
    if (import.meta.env.DEV) console.warn("local database not deleted", error);
  }
}

let database: BrowserWASQLiteDatabase | undefined;
let coordinator: BrowserCollectionCoordinator | undefined;
let wiped = false;

/**
 * Opens this browser's database. A boot without an owner stamp deletes it
 * first (a wipe the last page did not finish, or a first visit), so no
 * collection ever loads rows of a user who is not the signed-in one. Where
 * OPFS is missing (private windows, old browsers) there is no persistence and
 * synced collections work from the network alone.
 */
async function openLocalPersistence(): Promise<
  PersistedCollectionPersistence | undefined
> {
  if (!readOwnerStamp()) await deleteDatabaseFile();
  try {
    database = await openBrowserWASQLiteOPFSDatabase({
      databaseName: `${DATABASE_NAME}.sqlite`,
      timeoutMs: OPEN_TIMEOUT_MS,
    });
    // One tab writes each collection; the others follow it.
    coordinator = new BrowserCollectionCoordinator({ dbName: DATABASE_NAME });
    return createBrowserWASQLitePersistence({ database, coordinator });
  } catch (error) {
    if (
      !(error instanceof Error && error.name === "PersistenceUnavailableError")
    ) {
      Sentry.captureException(error, { tags: { area: "sync.persistence" } });
    }
    return undefined;
  }
}

/** The shared persistence of every synced collection, or undefined without OPFS. */
export const localPersistence = await openLocalPersistence();

/**
 * Whether this page started from a database that a signed-in user had filled:
 * its collections restore from it and the network catches up in the background.
 */
export const restoresFromLocal =
  localPersistence !== undefined && readOwnerStamp() !== null;

/**
 * Marks this page's database as going away: its collections cannot be used
 * again in this page (see `localDatabaseWiped`). Synchronous, so what runs
 * while the wipe is under way already sees it.
 */
export function beginLocalWipe() {
  if (localPersistence) wiped = true;
}

/**
 * Closes and deletes the database, once the collections using it are stopped.
 * The owner stamp must be removed first.
 */
export async function finishLocalWipe() {
  if (!localPersistence) return;
  coordinator?.dispose();
  await Promise.resolve(database?.close?.()).catch(() => undefined);
  await deleteDatabaseFile();
}

/** Whether this page closed its database, so synced collections need a fresh page. */
export function localDatabaseWiped() {
  return wiped;
}

/** Calls `onRemoved` when another tab removes the owner stamp (sign-out, wipe). */
export function watchOwnerStampRemoval(onRemoved: () => void) {
  window.addEventListener("storage", (event) => {
    if (event.key === OWNER_STAMP_KEY && event.newValue === null) onRemoved();
  });
}
