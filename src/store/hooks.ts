import { useEffect, useState, useSyncExternalStore } from "react";
import type { SessionStore } from "./SessionStore";

export function useSession(store: SessionStore) {
  return useSyncExternalStore(store.subscribe, store.getState);
}

/** Re-renders on a timer and returns the shared clock's current time. */
export function useNow(store: SessionStore, intervalMs = 250): number {
  const [now, setNow] = useState(() => store.now());
  useEffect(() => {
    setNow(store.now());
    const id = setInterval(() => setNow(store.now()), intervalMs);
    return () => clearInterval(id);
  }, [store, intervalMs]);
  return now;
}
