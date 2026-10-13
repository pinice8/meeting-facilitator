import { describe, expect, it } from "vitest";
import {
  MINUTE_MS,
  currentRemainingMs,
  currentTone,
  elapsedOf,
  finishSession,
  nextItem,
  pauseSession,
  previousItem,
  rebalance,
  resetSession,
  resumeSession,
  scheduleDeltaMs,
  setAgenda,
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

describe("rebalance", () => {
  it("shrinks the remaining items proportionally after an overrun", () => {
    // 30 min meeting, item 1 (10) is at 16 min → 14 min left for items 2 (10) and 3 (10) → 7 + 7
    let s = startSession(agenda([10, 10, 10]), T0);
    s = rebalance(s, T0 + min(16));
    expect(s.items.map((i) => i.minutes)).toEqual([10, 7, 7]);
  });

  it("subtracts the time still left on the current item", () => {
    // at minute 12: item 1 is over (0 left), 18 min for the other two → 9 + 9
    let s = startSession(agenda([10, 10, 10]), T0);
    s = rebalance(s, T0 + min(12));
    expect(s.items.map((i) => i.minutes)).toEqual([10, 9, 9]);
  });

  it("keeps proportions between unequal items", () => {
    let s = startSession(agenda([10, 10, 20], 40), T0);
    // item 1 is at 20 min of 40 → 20 left for 10 + 20 → 7 + 13 (largest remainder)
    s = rebalance(s, T0 + min(20));
    expect(s.items.map((i) => i.minutes)).toEqual([10, 7, 13]);
  });

  it("gives at least 1 minute each when there is not enough time", () => {
    let s = startSession(agenda([10, 10, 10]), T0);
    s = rebalance(s, T0 + min(29)); // 1 minute left for two items
    expect(s.items.map((i) => i.minutes)).toEqual([10, 1, 1]);
  });

  it("does nothing on the last item or outside a live session", () => {
    const last = nextItem(startSession(agenda([10, 10]), T0), T0 + min(1));
    expect(rebalance(last, T0 + min(2))).toBe(last);
    const setup = agenda([10, 10]);
    expect(rebalance(setup, T0)).toBe(setup);
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
