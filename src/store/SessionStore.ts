import type { SessionState } from "../core/types";

export type Transition = (state: SessionState, now: number) => SessionState;

/**
 * Where the shared meeting state lives. The UI only talks to this interface, so Live Share
 * can be swapped for a backend later without touching the UI or the core logic.
 */
export interface SessionStore {
  readonly mode: "live-share" | "local";
  /** Whether the local user may change the session (organizers and presenters). */
  readonly canControl: boolean;
  /** Shown to the user when the store is degraded (e.g. falling back to a local timer). */
  readonly notice?: string;
  /** Current time on the clock shared by all participants, in ms. */
  now(): number;
  /** Returns the same object until the state changes (safe for useSyncExternalStore). */
  getState(): SessionState;
  subscribe(listener: () => void): () => void;
  /** Synchronized time of the last facilitator heartbeat (undefined if none yet). */
  lastActiveAt(): number | undefined;
  /** Records "a facilitator is here now". No-op for read-only users. */
  heartbeat(): void;
  /** Applies a pure transition to the latest state and shares the result. No-op for read-only users. */
  update(transition: Transition): void;
}
