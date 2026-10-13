import type { SessionState } from "./types";

export const MINUTE_MS = 60_000;
/** The timer turns amber when this fraction of an item's time is left. */
export const WARN_FRACTION = 0.2;
/** Within this much of the plan we say "on schedule". */
export const ON_SCHEDULE_MS = 30_000;

export type Tone = "ok" | "warn" | "over";

const bump = (state: SessionState, changes: Partial<SessionState>): SessionState => ({
  ...state,
  ...changes,
  rev: state.rev + 1,
});

const isLive = (state: SessionState) => state.status === "running" || state.status === "paused";

// ---------- derived values (pure functions of state + now) ----------

export function elapsedOf(state: SessionState, index: number, now: number): number {
  const banked = state.elapsedMs[index] ?? 0;
  const live = state.status === "running" && index === state.currentIndex && state.runningSince !== null;
  return banked + (live ? Math.max(0, now - (state.runningSince as number)) : 0);
}

export function totalElapsedMs(state: SessionState, now: number): number {
  return state.items.reduce((sum, _item, i) => sum + elapsedOf(state, i, now), 0);
}

/** Negative once the current item is over time. */
export function currentRemainingMs(state: SessionState, now: number): number {
  const item = state.items[state.currentIndex];
  return item ? item.minutes * MINUTE_MS - elapsedOf(state, state.currentIndex, now) : 0;
}

export function currentTone(state: SessionState, now: number): Tone {
  const item = state.items[state.currentIndex];
  if (!item) return "ok";
  const remaining = currentRemainingMs(state, now);
  if (remaining <= 0) return "over";
  return remaining <= item.minutes * MINUTE_MS * WARN_FRACTION ? "warn" : "ok";
}

/** Positive = behind schedule, negative = ahead: overrun accumulated on finished items plus the current one. */
export function scheduleDeltaMs(state: SessionState, now: number): number {
  let delta = 0;
  for (let i = 0; i < state.currentIndex; i++) {
    delta += elapsedOf(state, i, now) - state.items[i].minutes * MINUTE_MS;
  }
  const current = state.items[state.currentIndex];
  if (current && isLive(state)) {
    delta += Math.max(0, elapsedOf(state, state.currentIndex, now) - current.minutes * MINUTE_MS);
  }
  return delta;
}

// ---------- transitions (pure; each returns a new state, or the same one when not applicable) ----------

function bank(state: SessionState, now: number): number[] {
  const elapsedMs = state.items.map((_item, i) => state.elapsedMs[i] ?? 0);
  if (state.status === "running" && state.runningSince !== null) {
    elapsedMs[state.currentIndex] += Math.max(0, now - state.runningSince);
  }
  return elapsedMs;
}

export function startSession(state: SessionState, now: number): SessionState {
  if (state.status !== "setup" || state.items.length === 0) return state;
  return bump(state, {
    status: "running",
    currentIndex: 0,
    elapsedMs: state.items.map(() => 0),
    runningSince: now,
  });
}

export function pauseSession(state: SessionState, now: number): SessionState {
  if (state.status !== "running") return state;
  return bump(state, { status: "paused", elapsedMs: bank(state, now), runningSince: null });
}

export function resumeSession(state: SessionState, now: number): SessionState {
  if (state.status !== "paused") return state;
  return bump(state, { status: "running", runningSince: now });
}

export function nextItem(state: SessionState, now: number): SessionState {
  if (!isLive(state)) return state;
  const elapsedMs = bank(state, now);
  if (state.currentIndex >= state.items.length - 1) {
    return bump(state, { status: "done", elapsedMs, runningSince: null });
  }
  return bump(state, {
    currentIndex: state.currentIndex + 1,
    elapsedMs,
    runningSince: state.status === "running" ? now : null,
  });
}

export function previousItem(state: SessionState, now: number): SessionState {
  if (!isLive(state) || state.currentIndex === 0) return state;
  return bump(state, {
    currentIndex: state.currentIndex - 1,
    elapsedMs: bank(state, now),
    runningSince: state.status === "running" ? now : null,
  });
}

export function finishSession(state: SessionState, now: number): SessionState {
  if (!isLive(state)) return state;
  return bump(state, { status: "done", elapsedMs: bank(state, now), runningSince: null });
}

/** Back to setup, keeping the agenda but clearing all timing data. */
export function resetSession(state: SessionState): SessionState {
  return bump(state, { status: "setup", currentIndex: 0, elapsedMs: [], runningSince: null });
}

/** Jumps straight to any item (forward or back). Each item keeps the time it has already used. */
export function goToItem(state: SessionState, index: number, now: number): SessionState {
  if (!isLive(state) || index === state.currentIndex || index < 0 || index >= state.items.length) return state;
  return bump(state, {
    currentIndex: index,
    elapsedMs: bank(state, now),
    runningSince: state.status === "running" ? now : null,
  });
}

/** Saves the agenda (only while in setup) so it can be prepared before the meeting. */
export function setAgenda(state: SessionState, items: SessionState["items"], totalMinutes: number): SessionState {
  if (state.status !== "setup") return state;
  return bump(state, { items, totalMinutes, currentIndex: 0, elapsedMs: [], runningSince: null });
}
