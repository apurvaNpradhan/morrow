import { createStore } from "./store";

export type StatusFault = {
  id: number;
  shape: string;
  status: 401 | 403 | 404 | 500;
};

type FaultState = {
  /** One-shot: each answers the next matching request, then disarms. */
  armed: StatusFault[];
  /** Added to every shape request until turned off. */
  latencyMs: number;
  /** Every shape request fails like a network error until turned off. */
  offline: boolean;
};

const STORAGE_KEY = "morrow.devtools.sync.faults";
const initial: FaultState = { armed: [], latencyMs: 0, offline: false };

let nextId = 1;
const store = /* @__PURE__ */ createStore<FaultState>(initial);

/** Latency and offline survive a reload, so a failing first load can be tested. */
function persist(state: FaultState) {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ latencyMs: state.latencyMs, offline: state.offline }),
    );
  } catch {
    // Storage can be blocked; the faults then last until reload.
  }
}

function change(patch: Partial<FaultState>) {
  const next = { ...store.get(), ...patch };
  store.set(next);
  persist(next);
}

export const faults = {
  get: store.get,
  subscribe: store.subscribe,
  arm: (fault: Omit<StatusFault, "id">) =>
    change({ armed: [...store.get().armed, { ...fault, id: nextId++ }] }),
  disarm: (fault: StatusFault) =>
    change({ armed: store.get().armed.filter((armed) => armed !== fault) }),
  setLatency: (latencyMs: number) => change({ latencyMs }),
  setOffline: (offline: boolean) => change({ offline }),
  /** Takes the first armed fault for this shape off the list and returns it. */
  take(shape: string): StatusFault | undefined {
    const { armed } = store.get();
    const fault =
      armed.find((candidate) => candidate.shape === shape) ??
      armed.find((candidate) => candidate.shape === "any");
    if (fault)
      change({ armed: store.get().armed.filter((armed) => armed !== fault) });
    return fault;
  },
  restore() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
      store.set({
        armed: [],
        latencyMs: Number(saved?.latencyMs) || 0,
        offline: saved?.offline === true,
      });
    } catch {
      store.set(initial);
    }
  },
};

export function resetFaults() {
  store.set(initial);
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // See `persist`.
  }
}

// Before the first shape request, so a reload can fail its first load.
if (import.meta.env.DEV) faults.restore();
