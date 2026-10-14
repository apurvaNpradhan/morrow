import { Button } from "@/design-system/ui/button";
import { clearRequestLog, requestLog } from "./request-log";
import { useStore } from "./use-store";

/** Every shape request, newest first, with the filter the proxy resolved. */
export function RequestsView() {
  const entries = useStore(requestLog);
  return (
    <div className="p-2 text-xs">
      <Button size="xs" variant="outline" onClick={clearRequestLog}>
        Clear
      </Button>
      <table className="mt-2 w-full text-left">
        <thead>
          <tr>
            {[
              "Time",
              "Shape",
              "Offset",
              "Live",
              "Status",
              "ms",
              "Msgs",
              "Filter",
            ].map((head) => (
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
              className={
                entry.status >= 400 || entry.status === 0 ? "text-red-400" : ""
              }
            >
              <td className="pr-3">
                {new Date(entry.startedAt).toLocaleTimeString()}
              </td>
              <td className="pr-3 font-mono">{entry.shape}</td>
              <td className="pr-3 font-mono">{entry.offset}</td>
              <td className="pr-3">{entry.live ? "yes" : ""}</td>
              <td className="pr-3">
                {entry.fault
                  ? `${entry.fault} (injected)`
                  : (entry.error ?? entry.status)}
              </td>
              <td className="pr-3">{entry.durationMs}</td>
              <td className="pr-3">{entry.messages ?? ""}</td>
              <td className="font-mono" title={entry.params ?? undefined}>
                {entry.where ? `${entry.where}  ${entry.params}` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
