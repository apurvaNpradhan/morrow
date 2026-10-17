import { useEffect, useSyncExternalStore } from "react";
import type { Command } from "./use-commands";

/*
 * Commands that only make sense while a page is showing (the task commands, on
 * a project or task page). The page contributes them while it is mounted and
 * the palette lists them with the app's own.
 */

const sources = new Map<string, Command[]>();
const listeners = new Set<() => void>();
let snapshot: Command[] = [];

function publish() {
  snapshot = [...sources.values()].flat();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useContributedCommands() {
  return useSyncExternalStore(subscribe, () => snapshot);
}

/** Lists `commands` (memoize them) while the calling component is mounted. */
export function useContributeCommands(source: string, commands: Command[]) {
  useEffect(() => {
    sources.set(source, commands);
    publish();
    return () => {
      sources.delete(source);
      publish();
    };
  }, [source, commands]);
}
