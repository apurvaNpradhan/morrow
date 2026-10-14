import { useEffect, useReducer, useState } from "react";
import { Button } from "@/design-system/ui/button";
import { cleanupSyncedCollections } from "@/app/sync/synced-collections";
import { trackedCollections } from "./collection-registry";
import { latestByShape } from "./latest-by-shape";
import { requestLog } from "./request-log";
import { useStore } from "./use-store";

function ago(timestamp: number | undefined) {
  return timestamp === undefined
    ? "never"
    : `${Math.round((Date.now() - timestamp) / 1000)}s ago`;
}

/** One row per synced collection; selecting one shows its rows as JSON. */
export function CollectionsView() {
  const collections = useStore(trackedCollections);
  // Status and row counts live on the collections, which do not notify us.
  const [, tick] = useReducer((count: number) => count + 1, 0);
  useEffect(() => {
    const timer = setInterval(tick, 1_000);
    return () => clearInterval(timer);
  }, []);
  const states = latestByShape(useStore(requestLog));
  const [selected, setSelected] = useState<string>();
  const [filter, setFilter] = useState("");
  const open = collections.find((collection) => collection.id === selected);
  const rows = open?.toArray
    .map((row) => JSON.stringify(row, null, 2))
    .filter((json) => json.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="p-2 text-xs">
      <div className="mb-2">
        <Button
          size="xs"
          variant="outline"
          onClick={() => void cleanupSyncedCollections()}
        >
          Clean up all (as sign-out)
        </Button>
      </div>
      <table className="w-full text-left">
        <thead>
          <tr>
            {[
              "Collection",
              "Status",
              "Rows",
              "Handle",
              "Offset",
              "Live",
              "Up to date",
              "",
            ].map((head) => (
              <th key={head} className="pr-3 font-medium">
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {collections.map((collection) => {
            const state = states.get(collection.id);
            return (
              <tr
                key={collection.id}
                className="cursor-pointer hover:bg-white/5"
                onClick={() => setSelected(collection.id)}
              >
                <td className="pr-3 font-mono">{collection.id}</td>
                <td className="pr-3">{collection.status}</td>
                <td className="pr-3">{collection.size}</td>
                <td className="pr-3 font-mono">{state?.handle ?? "–"}</td>
                <td className="pr-3 font-mono">{state?.offset ?? "–"}</td>
                <td className="pr-3">
                  {state ? (state.live ? "yes" : "no") : "–"}
                </td>
                <td className="pr-3">{ago(state?.lastUpToDate)}</td>
                <td>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={(event) => {
                      event.stopPropagation();
                      void collection
                        .cleanup()
                        .then(() => collection.preload());
                    }}
                  >
                    Resync
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {open && rows ? (
        <div className="mt-3">
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder={`Filter ${open.id} rows`}
            className="mb-2 w-full rounded border bg-transparent px-2 py-1"
          />
          <pre className="max-h-72 overflow-auto font-mono">
            {rows.join("\n")}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
