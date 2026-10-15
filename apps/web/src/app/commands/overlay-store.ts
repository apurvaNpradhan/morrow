import { useEffect, useSyncExternalStore } from "react";

export type Overlay =
  | "palette"
  | "help"
  | "createWorkspace"
  | "createProject"
  | "inviteMember"
  | "workspaceSwitcher";

let current: Overlay | null = null;
const listeners = new Set<() => void>();

function set(next: Overlay | null) {
  if (next === current) return;
  current = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Opens an overlay, closing whichever one was open. */
export function openOverlay(overlay: Overlay) {
  set(overlay);
}

export function toggleOverlay(overlay: Overlay) {
  set(current === overlay ? null : overlay);
}

/** Closes `overlay` only if it is the open one; with no argument closes any. */
export function closeOverlay(overlay?: Overlay) {
  if (overlay && current !== overlay) return;
  set(null);
}

export function useIsOverlayOpen(overlay: Overlay) {
  return useSyncExternalStore(subscribe, () => current === overlay);
}

const hosts = new Map<Overlay, number>();

/** A mounted component that can show `overlay` registers, so commands only offer overlays that have somewhere to render. */
export function useRegisterOverlayHost(overlay: Overlay) {
  useEffect(() => {
    hosts.set(overlay, (hosts.get(overlay) ?? 0) + 1);
    for (const listener of listeners) listener();
    return () => {
      hosts.set(overlay, (hosts.get(overlay) ?? 1) - 1);
      closeOverlay(overlay);
      for (const listener of listeners) listener();
    };
  }, [overlay]);
}

export function useHasOverlayHost(overlay: Overlay) {
  return useSyncExternalStore(subscribe, () => (hosts.get(overlay) ?? 0) > 0);
}
