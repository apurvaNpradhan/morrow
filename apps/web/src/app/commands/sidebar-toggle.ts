import { useEffect, useSyncExternalStore } from "react";

let toggle: (() => void) | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function set(next: (() => void) | null) {
  toggle = next;
  for (const listener of listeners) listener();
}

/** A mounted sidebar hands over its toggle so commands outside its provider can use it. */
export function useRegisterSidebarToggle(toggleSidebar: () => void) {
  useEffect(() => {
    set(toggleSidebar);
    return () => {
      if (toggle === toggleSidebar) set(null);
    };
  }, [toggleSidebar]);
}

export function useSidebarToggle() {
  return useSyncExternalStore(subscribe, () => toggle);
}
