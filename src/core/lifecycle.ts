import { resetSession, startSession } from "./timer";
import type { SessionState } from "./types";

/** How often a facilitator's open panel refreshes the heartbeat. */
export const HEARTBEAT_MS = 10_000;
/**
 * A heartbeat older than this means no facilitator panel was open for a while. Three missed
 * beats: long enough to ride out a panel reload, short enough that ending the meeting and
 * starting it again counts as a new run.
 */
export const RUN_STALE_MS = 30_000;

export type LifecycleAction = "none" | "start" | "restart" | "reset";

export interface LifecycleContext {
  /** The app is open inside the live meeting (side panel / stage), not in the pre-meeting chat tab. */
  inMeeting: boolean;
  canControl: boolean;
  /** Synchronized time of the last facilitator heartbeat, if any. */
  lastActiveAt?: number;
  /** Another participant currently has the app open inside the meeting. */
  othersInMeeting: boolean;
  now: number;
}

/**
 * Decides what a facilitator's view should do when it opens. A saved run is "in progress" only if
 * someone else is in the meeting with the app open, or a facilitator panel was seen moments ago;
 * otherwise it belongs to a meeting that already ended.
 * - in the meeting, agenda saved, nothing running yet → start it;
 * - in the meeting, a finished-looking run is saved → start fresh;
 * - before the meeting, an old run is still saved → show the agenda ready again (reset, don't start);
 * - otherwise leave it alone (we are joining a run that is in progress).
 */
export function lifecycleAction(state: SessionState, ctx: LifecycleContext): LifecycleAction {
  if (!ctx.canControl || state.items.length === 0) return "none";
  const recentlyActive = ctx.lastActiveAt !== undefined && ctx.now - ctx.lastActiveAt <= RUN_STALE_MS;
  const inProgress = ctx.othersInMeeting || recentlyActive;
  if (!ctx.inMeeting) return state.status !== "setup" && !inProgress ? "reset" : "none";
  if (state.status === "setup") return "start";
  return inProgress ? "none" : "restart";
}

export function applyLifecycle(state: SessionState, action: LifecycleAction, now: number): SessionState {
  if (action === "start") return startSession(state, now);
  if (action === "restart") return startSession(resetSession(state), now);
  if (action === "reset") return resetSession(state);
  return state;
}
