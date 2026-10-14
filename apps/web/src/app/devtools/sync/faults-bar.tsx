import { useState } from "react";
import { Button } from "@/design-system/ui/button";
import { Switch } from "@/design-system/ui/switch";
import { faults, type StatusFault } from "./faults";
import { useStore } from "./use-store";

const STATUSES: StatusFault["status"][] = [401, 403, 404, 500];

/** Arms faults for shape requests. Status faults fire once; the rest stay on. */
export function FaultsBar({ shapes }: { shapes: string[] }) {
  const state = useStore(faults);
  const [target, setTarget] = useState("any");
  return (
    <div className="flex flex-wrap items-center gap-3 border-b p-2 text-xs">
      <label className="flex items-center gap-1">
        Next request to
        <select
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          className="rounded border bg-transparent px-1 py-0.5"
        >
          <option value="any">any shape</option>
          {shapes.map((shape) => (
            <option key={shape} value={shape}>
              {shape}
            </option>
          ))}
        </select>
        →
      </label>
      {STATUSES.map((status) => (
        <Button
          key={status}
          size="xs"
          variant="outline"
          onClick={() => faults.arm({ shape: target, status })}
        >
          {status}
        </Button>
      ))}
      {state.armed.map((fault) => (
        <Button
          key={fault.id}
          size="xs"
          variant="secondary"
          onClick={() => faults.disarm(fault)}
        >
          armed: {fault.status} on {fault.shape} ✕
        </Button>
      ))}
      <label className="flex items-center gap-1">
        <Switch checked={state.offline} onCheckedChange={faults.setOffline} />{" "}
        offline
      </label>
      <label className="flex items-center gap-1">
        latency
        <select
          value={state.latencyMs}
          onChange={(event) => faults.setLatency(Number(event.target.value))}
          className="rounded border bg-transparent px-1 py-0.5"
        >
          {[0, 500, 3_000, 6_000].map((ms) => (
            <option key={ms} value={ms}>
              {ms === 0 ? "off" : `${ms} ms`}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
