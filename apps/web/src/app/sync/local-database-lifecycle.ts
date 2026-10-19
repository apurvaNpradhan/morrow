import { watchOwnerStampRemoval } from "./local-database";
import { cleanupSyncedCollections } from "./synced-collections";

/**
 * Browser-wide events that end this page's use of the local database. The
 * library terminates its worker on `pagehide`, so a page restored from the
 * back/forward cache has no database and reloads. Another tab signing out
 * removes the owner stamp: this tab drops its data and leaves too.
 */
export function watchLocalDatabaseLifecycle() {
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) window.location.reload();
  });
  watchOwnerStampRemoval(() => {
    void cleanupSyncedCollections().finally(() =>
      window.location.replace("/auth/sign-in"),
    );
  });
}
