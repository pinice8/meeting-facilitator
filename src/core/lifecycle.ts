import { resetSession, startSession } from "./timer";
import type { SessionState } from "./types";

/** A saved run whose last heartbeat is older than this is treated as a meeting that already ended. */
export const RUN_STALE_MS = 10 * 60_000;
/** How often a facilitator's open panel refreshes the heartbeat. */
export const HEARTBEAT_MS = 20_000;

export type LifecycleAction = "none" | "start" | "restart";

export interface LifecycleContext {
  /** The app is open inside the live meeting (side panel / stage), not in the pre-meeting chat tab. */
  inMeeting: boolean;
  canControl: boolean;
  /** Synchronized time of the last facilitator heartbeat, if any. */
  lastActiveAt?: number;
  now: number;
}

/**
 * Decides what a facilitator's panel should do when it opens in the meeting:
 * - agenda saved, nothing running yet → start it;
 * - a run exists but nobody has been around for a while → the previous meeting ended, start fresh;
 * - otherwise leave it alone (we are joining a run that is in progress).
 */
export function lifecycleAction(state: SessionState, ctx: LifecycleContext): LifecycleAction {
  if (!ctx.inMeeting || !ctx.canControl || state.items.length === 0) return "none";
  if (state.status === "setup") return "start";
  const stale = ctx.lastActiveAt === undefined || ctx.now - ctx.lastActiveAt > RUN_STALE_MS;
  return stale ? "restart" : "none";
}

export function applyLifecycle(state: SessionState, action: LifecycleAction, now: number): SessionState {
  if (action === "start") return startSession(state, now);
  if (action === "restart") return startSession(resetSession(state), now);
  return state;
}
