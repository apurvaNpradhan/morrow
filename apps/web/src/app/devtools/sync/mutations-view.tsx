import { Button } from "@/design-system/ui/button";
import { clearMutationLog, mutationLog } from "./mutation-log";
import { useStore } from "./use-store";

/** Every wait for a write to come back through sync, newest first. */
export function MutationsView() {
  const entries = useStore(mutationLog);
  return (
    <div className="p-2 text-xs">
      <Button size="xs" variant="outline" onClick={clearMutationLog}>
        Clear
      </Button>
      <table className="mt-2 w-full text-left">
        <thead>
          <tr>
            {["Time", "Collection", "Wait", "Outcome", "ms"].map((head) => (
              <th key={head} className="pr-3 font-medium">
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...entries].reverse().map((entry) => (
            <tr
              key={entry.id}
              className={entry.outcome === "timed-out" ? "text-red-400" : ""}
            >
              <td className="pr-3">
                {new Date(entry.startedAt).toLocaleTimeString()}
              </td>
              <td className="pr-3 font-mono">{entry.collection}</td>
              <td className="pr-3 font-mono">
                {entry.kind === "txid" ? `txid ${entry.label}` : "match"}
              </td>
              <td className="pr-3">{entry.outcome}</td>
              <td className="pr-3">{entry.durationMs ?? "…"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
