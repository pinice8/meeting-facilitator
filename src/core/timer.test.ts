import { describe, expect, it } from "vitest";
import {
  MINUTE_MS,
  currentRemainingMs,
  currentTone,
  elapsedOf,
  finishSession,
  goToItem,
  nextItem,
  pauseSession,
  previousItem,
  resetSession,
  resumeSession,
  scheduleDeltaMs,
  setAgenda,
  markAnnounced,
  pendingAnnouncement,
  startSession,
  totalElapsedMs,
} from "./timer";
import { emptySession, type SessionState } from "./types";

const T0 = 1_000_000;
const min = (n: number) => n * MINUTE_MS;

function agenda(minutes: number[], total = minutes.reduce((a, b) => a + b, 0)): SessionState {
  return {
    ...emptySession(total),
    items: minutes.map((m, i) => ({ id: `item-${i + 1}`, title: `Item ${i + 1}`, minutes: m })),
  };
}

describe("starting", () => {
  it("starts the first item", () => {
    const s = startSession(agenda([10, 10]), T0);
    expect(s.status).toBe("running");
    expect(s.currentIndex).toBe(0);
    expect(currentRemainingMs(s, T0 + min(3))).toBe(min(7));
  });

  it("refuses to start an empty agenda or a session that is not in setup", () => {
    const empty = emptySession();
    expect(startSession(empty, T0)).toBe(empty);
    const running = startSession(agenda([10]), T0);
    expect(startSession(running, T0)).toBe(running);
  });

  it("bumps rev on every change", () => {
    const a = agenda([10]);
    expect(startSession(a, T0).rev).toBe(a.rev + 1);
  });
});

describe("pause and resume", () => {
  it("stops the clock while paused", () => {
    let s = startSession(agenda([10]), T0);
    s = pauseSession(s, T0 + min(2));
    expect(elapsedOf(s, 0, T0 + min(50))).toBe(min(2));
    s = resumeSession(s, T0 + min(50));
    expect(elapsedOf(s, 0, T0 + min(53))).toBe(min(5));
  });

  it("ignores pause when not running and resume when not paused", () => {
    const setup = agenda([10]);
    expect(pauseSession(setup, T0)).toBe(setup);
    const running = startSession(setup, T0);
    expect(resumeSession(running, T0)).toBe(running);
  });
});

describe("moving between items", () => {
  it("banks the time and starts the next item at zero", () => {
    let s = startSession(agenda([10, 10]), T0);
    s = nextItem(s, T0 + min(4));
    expect(s.currentIndex).toBe(1);
    expect(elapsedOf(s, 0, T0 + min(9))).toBe(min(4));
    expect(elapsedOf(s, 1, T0 + min(9))).toBe(min(5));
  });

  it("stays paused when advancing while paused", () => {
    let s = startSession(agenda([10, 10]), T0);
    s = pauseSession(s, T0 + min(1));
    s = nextItem(s, T0 + min(2));
    expect(s.status).toBe("paused");
    expect(s.runningSince).toBeNull();
  });

  it("finishes the session when advancing past the last item", () => {
    let s = startSession(agenda([10]), T0);
    s = nextItem(s, T0 + min(6));
    expect(s.status).toBe("done");
    expect(totalElapsedMs(s, T0 + min(99))).toBe(min(6));
  });

  it("goes back to the previous item and keeps its accumulated time", () => {
    let s = startSession(agenda([10, 10]), T0);
    s = nextItem(s, T0 + min(4));
    s = previousItem(s, T0 + min(6));
    expect(s.currentIndex).toBe(0);
    expect(elapsedOf(s, 0, T0 + min(7))).toBe(min(5));
    expect(elapsedOf(s, 1, T0 + min(7))).toBe(min(2));
  });

  it("cannot go before the first item", () => {
    const s = startSession(agenda([10, 10]), T0);
    expect(previousItem(s, T0)).toBe(s);
  });

  it("ends early with finishSession and returns to setup with resetSession", () => {
    let s = startSession(agenda([10, 10]), T0);
    s = finishSession(s, T0 + min(3));
    expect(s.status).toBe("done");
    s = resetSession(s);
    expect(s.status).toBe("setup");
    expect(s.items).toHaveLength(2);
    expect(s.elapsedMs).toEqual([]);
  });
});

describe("tone", () => {
  it("is ok, then warn at 20% left, then over at zero", () => {
    const s = startSession(agenda([10]), T0);
    expect(currentTone(s, T0 + min(7))).toBe("ok");
    expect(currentTone(s, T0 + min(8))).toBe("warn");
    expect(currentTone(s, T0 + min(10))).toBe("over");
    expect(currentRemainingMs(s, T0 + min(12))).toBe(-min(2));
  });
});

describe("scheduleDeltaMs", () => {
  it("is zero while the current item is within its time", () => {
    const s = startSession(agenda([10, 10]), T0);
    expect(scheduleDeltaMs(s, T0 + min(5))).toBe(0);
  });

  it("counts overrun on the current item", () => {
    const s = startSession(agenda([10, 10]), T0);
    expect(scheduleDeltaMs(s, T0 + min(13))).toBe(min(3));
  });

  it("carries overrun and underrun of finished items", () => {
    let s = startSession(agenda([10, 10, 10]), T0);
    s = nextItem(s, T0 + min(13)); // item 1 took 13 (+3)
    s = nextItem(s, T0 + min(13) + min(6)); // item 2 took 6 (-4)
    expect(scheduleDeltaMs(s, T0 + min(19))).toBe(-min(1));
  });
});

describe("goToItem", () => {
  it("jumps forward, banking the time spent on the current item", () => {
    let s = startSession(agenda([10, 10, 10]), T0);
    s = goToItem(s, 2, T0 + min(4));
    expect(s.currentIndex).toBe(2);
    expect(elapsedOf(s, 0, T0 + min(6))).toBe(min(4));
    expect(elapsedOf(s, 1, T0 + min(6))).toBe(0);
    expect(elapsedOf(s, 2, T0 + min(6))).toBe(min(2));
  });

  it("jumps back and resumes that item's accumulated time", () => {
    let s = startSession(agenda([10, 10, 10]), T0);
    s = nextItem(s, T0 + min(4));
    s = goToItem(s, 0, T0 + min(6));
    expect(s.currentIndex).toBe(0);
    expect(elapsedOf(s, 0, T0 + min(7))).toBe(min(5));
  });

  it("stays paused when jumping while paused", () => {
    let s = pauseSession(startSession(agenda([10, 10]), T0), T0 + min(1));
    s = goToItem(s, 1, T0 + min(2));
    expect(s.status).toBe("paused");
    expect(s.runningSince).toBeNull();
    expect(s.currentIndex).toBe(1);
  });

  it("ignores the current item, out-of-range indexes and sessions that are not live", () => {
    const s = startSession(agenda([10, 10]), T0);
    expect(goToItem(s, 0, T0)).toBe(s);
    expect(goToItem(s, 2, T0)).toBe(s);
    expect(goToItem(s, -1, T0)).toBe(s);
    const setup = agenda([10, 10]);
    expect(goToItem(setup, 1, T0)).toBe(setup);
  });
});

describe("setAgenda", () => {
  it("saves items and total in setup, and is ignored once the meeting is live", () => {
    const items = [{ id: "item-1", title: "A", minutes: 5 }];
    const saved = setAgenda(emptySession(30), items, 20);
    expect(saved.items).toEqual(items);
    expect(saved.totalMinutes).toBe(20);
    const running = startSession(saved, T0);
    expect(setAgenda(running, [], 5)).toBe(running);
  });
});

describe("announcements", () => {
  const withWho = (): SessionState => ({
    ...agenda([10, 10]),
    items: [
      { id: "item-1", title: "A", minutes: 10, participants: ["Alice"] },
      { id: "item-2", title: "B", minutes: 10 },
    ],
  });

  it("is pending for a running item with participants that was not announced yet", () => {
    const s = startSession(withWho(), T0);
    expect(pendingAnnouncement(s)?.id).toBe("item-1");
  });

  it("is not pending once announced, while paused, in setup, or for items without participants", () => {
    const s = startSession(withWho(), T0);
    expect(pendingAnnouncement(markAnnounced(s, "item-1"))).toBeUndefined();
    expect(pendingAnnouncement(pauseSession(s, T0 + 1))).toBeUndefined();
    expect(pendingAnnouncement(withWho())).toBeUndefined();
    expect(pendingAnnouncement(nextItem(markAnnounced(s, "item-1"), T0 + 1))).toBeUndefined();
  });

  it("a new run starts with nothing announced", () => {
    const first = markAnnounced(startSession(withWho(), T0), "item-1");
    expect(first.announced).toEqual(["item-1"]);
    expect(resetSession(first).announced).toEqual([]);
    expect(setAgenda(resetSession(first), first.items, 20).announced).toEqual([]);
  });

  it("tolerates a state saved before the announced list existed", () => {
    const old = { ...startSession(withWho(), T0) } as Partial<SessionState> as SessionState;
    delete (old as Partial<SessionState>).announced;
    expect(pendingAnnouncement(old)?.id).toBe("item-1");
    expect(markAnnounced(old, "item-1").announced).toEqual(["item-1"]);
  });
});
