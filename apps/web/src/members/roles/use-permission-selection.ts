import { useMemo, useState } from "react";

export type PermissionSelection = Record<string, Set<string>>;

/** The role editor's working copy: which actions are on for each resource. */
export function usePermissionSelection(initial: Record<string, string[]>) {
  const [selection, setSelection] = useState<PermissionSelection>(() => {
    const out: PermissionSelection = Object.create(null);
    for (const [resource, actions] of Object.entries(initial)) {
      out[resource] = new Set(actions);
    }
    return out;
  });

  const toggle = (resource: string, action: string) => {
    setSelection((prev) => {
      const next = { ...prev };
      const set = new Set(next[resource] ?? []);
      if (set.has(action)) set.delete(action);
      else set.add(action);
      next[resource] = set;
      return next;
    });
  };

  /** The selection as saved: resources with nothing on are left out. */
  const permission = useMemo(() => {
    const out: Record<string, string[]> = Object.create(null);
    for (const [resource, set] of Object.entries(selection)) {
      if (set.size > 0) out[resource] = Array.from(set);
    }
    return out;
  }, [selection]);

  return { selection, toggle, permission };
}
