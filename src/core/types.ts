export interface AgendaItem {
  id: string;
  title: string;
  /** Planned minutes for this item. */
  minutes: number;
  /** Who is presenting or involved in this item (a note shown with the item). */
  participants?: string[];
}

export type SessionStatus = "setup" | "running" | "paused" | "done";

/** The whole shared meeting state. Everything the panels render derives from this plus a clock. */
export interface SessionState {
  /** Incremented on every change, so clients can ignore stale snapshots. */
  rev: number;
  status: SessionStatus;
  totalMinutes: number;
  items: AgendaItem[];
  currentIndex: number;
  /** Milliseconds spent per item, accumulated up to `runningSince`. */
  elapsedMs: number[];
  /** Synchronized timestamp at which the current item's clock last resumed; null while not running. */
  runningSince: number | null;
}

export function emptySession(totalMinutes = 30): SessionState {
  return {
    rev: 0,
    status: "setup",
    totalMinutes,
    items: [],
    currentIndex: 0,
    elapsedMs: [],
    runningSince: null,
  };
}
