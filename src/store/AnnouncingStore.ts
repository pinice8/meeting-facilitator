import type { AgendaItem } from "../core/types";
import { markAnnounced, pendingAnnouncement } from "../core/timer";
import type { SessionState } from "../core/types";
import type { SessionStore, Transition } from "./SessionStore";

/**
 * Wraps a store so that whichever facilitator's action makes an item start also calls that item's
 * participants in. The "announced" mark is written in the same update as the change itself, so
 * other facilitators' panels see it and never send a second message; only the acting client sends.
 */
export class AnnouncingStore implements SessionStore {
  constructor(
    private readonly inner: SessionStore,
    private readonly announce: (item: AgendaItem) => void,
  ) {}

  get mode() {
    return this.inner.mode;
  }
  get canControl() {
    return this.inner.canControl;
  }
  get notice() {
    return this.inner.notice;
  }
  now = () => this.inner.now();
  getState = (): SessionState => this.inner.getState();
  subscribe = (listener: () => void) => this.inner.subscribe(listener);
  lastActiveAt = () => this.inner.lastActiveAt();
  heartbeat = () => this.inner.heartbeat();
  othersInMeeting = (waitForPresence?: boolean) => this.inner.othersInMeeting(waitForPresence);

  update(transition: Transition): void {
    let pending: AgendaItem | undefined;
    this.inner.update((state, now) => {
      let next = transition(state, now);
      if (next === state) return state;
      pending = pendingAnnouncement(next);
      if (pending) next = markAnnounced(next, pending.id);
      return next;
    });
    if (pending) this.announce(pending);
  }
}
