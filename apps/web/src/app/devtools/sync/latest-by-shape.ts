import type { RequestEntry } from "./request-log";

export type ShapeState = {
  handle: string | null;
  offset: string | null;
  live: boolean;
  lastUpToDate: number | undefined;
};

/** What the request log says about each shape's stream right now. */
export function latestByShape(
  entries: RequestEntry[],
): Map<string, ShapeState> {
  const states = new Map<string, ShapeState>();
  for (const entry of entries) {
    const previous = states.get(entry.shape);
    states.set(entry.shape, {
      handle: entry.handle ?? previous?.handle ?? null,
      offset: entry.offset,
      live: entry.live,
      lastUpToDate: entry.upToDate
        ? entry.startedAt + entry.durationMs
        : previous?.lastUpToDate,
    });
  }
  return states;
}
