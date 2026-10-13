import { useCallback, useEffect, useState } from "react";
import type { SessionStore } from "../store/SessionStore";
import type { SessionState, SessionStatus } from "../core/types";
import { HEARTBEAT_MS, applyLifecycle, lifecycleAction, type LifecycleAction } from "../core/lifecycle";

export interface Diagnostics {
  action: LifecycleAction;
  status: SessionStatus;
  othersInMeeting: boolean;
  /** Seconds since a facilitator was last seen, when the check ran (undefined: never). */
  seenSecondsAgo?: number;
}

export interface AutoRestart {
  /** The run that was replaced, so the facilitator can put it back. */
  previous: SessionState;
}

const UNDO_WINDOW_MS = 60_000;

/**
 * Keeps the run in step with the meeting for facilitators:
 * - in the meeting: starts the saved agenda, restarts a leftover run, and keeps a heartbeat;
 * - before the meeting: keeps checking, so an old run that nobody is running any more goes back to "ready";
 * - re-checks whenever the page becomes visible again.
 * The latest decision is returned so the footer can show it (we cannot see the user's Teams session).
 */
export function useLifecycle(store: SessionStore, inMeeting: boolean) {
  const [diagnostics, setDiagnostics] = useState<Diagnostics>();
  const [restart, setRestart] = useState<AutoRestart | null>(null);

  useEffect(() => {
    if (!store.canControl) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const decide = async (waitForPresence: boolean) => {
      const othersInMeeting = await store.othersInMeeting(waitForPresence);
      if (cancelled) return;
      const before = store.getState();
      const lastActiveAt = store.lastActiveAt();
      const now = store.now();
      const action = lifecycleAction(before, { inMeeting, canControl: true, lastActiveAt, othersInMeeting, now });
      setDiagnostics({
        action,
        status: before.status,
        othersInMeeting,
        seenSecondsAgo: lastActiveAt === undefined ? undefined : Math.round((now - lastActiveAt) / 1000),
      });
      if (action === "none") return;
      store.update((s, n) => applyLifecycle(s, action, n));
      if (action === "restart") setRestart({ previous: before });
    };

    void (async () => {
      // Decide before our own heartbeat overwrites the evidence of whether the last run is still alive.
      await decide(true);
      if (cancelled) return;
      if (inMeeting) store.heartbeat();
      timer = setInterval(() => {
        if (inMeeting) store.heartbeat();
        else void decide(false);
      }, HEARTBEAT_MS);
    })();

    const onVisible = () => {
      if (document.visibilityState === "visible") void decide(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [store, inMeeting]);

  useEffect(() => {
    if (!restart) return;
    const id = setTimeout(() => setRestart(null), UNDO_WINDOW_MS);
    return () => clearTimeout(id);
  }, [restart]);

  const undo = useCallback(() => {
    if (!restart) return;
    store.update((s) => ({ ...restart.previous, rev: s.rev + 1 }));
    setRestart(null);
  }, [store, restart]);

  const dismiss = useCallback(() => setRestart(null), []);

  return { diagnostics, restart, undo, dismiss };
}
