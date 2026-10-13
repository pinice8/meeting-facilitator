import { emptySession, type SessionState } from "../core/types";
import type { SessionStore, Transition } from "./SessionStore";

export interface MemoryStoreOptions {
  canControl?: boolean;
  initial?: SessionState;
  clock?: () => number;
  notice?: string;
  lastActiveAt?: number;
}

/** Local-only store: used by the dev harness, tests, and as the fallback when Live Share is unavailable. */
export class MemoryStore implements SessionStore {
  readonly mode = "local" as const;
  readonly canControl: boolean;
  readonly notice?: string;
  private state: SessionState;
  private active?: number;
  private readonly listeners = new Set<() => void>();
  private readonly clock: () => number;

  constructor(options: MemoryStoreOptions = {}) {
    this.canControl = options.canControl ?? true;
    this.notice = options.notice;
    this.state = options.initial ?? emptySession();
    this.active = options.lastActiveAt;
    this.clock = options.clock ?? Date.now;
  }

  now = () => this.clock();
  getState = () => this.state;
  lastActiveAt = () => this.active;

  heartbeat(): void {
    if (this.canControl) this.active = this.now();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  update(transition: Transition): void {
    if (!this.canControl) return;
    const next = transition(this.state, this.now());
    if (next === this.state) return;
    this.state = next;
    this.listeners.forEach((listener) => listener());
  }
}
