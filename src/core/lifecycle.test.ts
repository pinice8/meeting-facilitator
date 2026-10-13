import { describe, expect, it } from "vitest";
import { RUN_STALE_MS, applyLifecycle, lifecycleAction, type LifecycleContext } from "./lifecycle";
import { nextItem, startSession } from "./timer";
import { emptySession, type SessionState } from "./types";

const NOW = 10_000_000;
const withItems = (): SessionState => ({
  ...emptySession(30),
  items: [
    { id: "item-1", title: "A", minutes: 10 },
    { id: "item-2", title: "B", minutes: 20 },
  ],
});
const ctx = (over: Partial<LifecycleContext> = {}): LifecycleContext => ({
  inMeeting: true,
  canControl: true,
  lastActiveAt: undefined,
  othersInMeeting: false,
  now: NOW,
  ...over,
});
const running = () => startSession(withItems(), NOW - 600_000);

describe("lifecycleAction in the meeting", () => {
  it("starts a saved agenda when a facilitator opens the app", () => {
    expect(lifecycleAction(withItems(), ctx())).toBe("start");
  });

  it("does nothing for attendees or without an agenda", () => {
    expect(lifecycleAction(withItems(), ctx({ canControl: false }))).toBe("none");
    expect(lifecycleAction(emptySession(), ctx())).toBe("none");
  });

  it("joins a run in progress when another participant is in the meeting", () => {
    expect(lifecycleAction(running(), ctx({ othersInMeeting: true }))).toBe("none");
  });

  it("joins a run in progress when a facilitator was seen moments ago (e.g. a panel reload)", () => {
    expect(lifecycleAction(running(), ctx({ lastActiveAt: NOW - 8_000 }))).toBe("none");
  });

  it("restarts when nobody is around and the heartbeat is stale (meeting ended and started again)", () => {
    expect(lifecycleAction(running(), ctx({ lastActiveAt: NOW - RUN_STALE_MS - 1 }))).toBe("restart");
  });

  it("restarts even a short gap, as long as it is longer than a reload", () => {
    expect(lifecycleAction(running(), ctx({ lastActiveAt: NOW - 45_000 }))).toBe("restart");
  });

  it("restarts a finished run nobody is around for", () => {
    let done = startSession(withItems(), NOW - 3_600_000);
    done = nextItem(nextItem(done, NOW - 3_000_000), NOW - 2_000_000);
    expect(done.status).toBe("done");
    expect(lifecycleAction(done, ctx({ lastActiveAt: NOW - 1_000_000 }))).toBe("restart");
  });

  it("treats a run with no heartbeat at all as old", () => {
    expect(lifecycleAction(running(), ctx())).toBe("restart");
  });

  it("does not restart on a stale heartbeat while others are in the meeting", () => {
    expect(lifecycleAction(running(), ctx({ lastActiveAt: NOW - 600_000, othersInMeeting: true }))).toBe("none");
  });
});

describe("lifecycleAction before the meeting", () => {
  const pre = (over: Partial<LifecycleContext> = {}) => ctx({ inMeeting: false, ...over });

  it("never starts anything", () => {
    expect(lifecycleAction(withItems(), pre())).toBe("none");
  });

  it("shows a stale old run as ready again instead of running", () => {
    expect(lifecycleAction(running(), pre({ lastActiveAt: NOW - RUN_STALE_MS - 1 }))).toBe("reset");
    expect(lifecycleAction(running(), pre())).toBe("reset");
  });

  it("leaves a run alone while a facilitator is active or others are in the meeting", () => {
    expect(lifecycleAction(running(), pre({ lastActiveAt: NOW - 5_000 }))).toBe("none");
    expect(lifecycleAction(running(), pre({ othersInMeeting: true }))).toBe("none");
  });
});

describe("applyLifecycle", () => {
  it("start runs the first item", () => {
    const s = applyLifecycle(withItems(), "start", NOW);
    expect(s.status).toBe("running");
    expect(s.currentIndex).toBe(0);
    expect(s.runningSince).toBe(NOW);
  });

  it("restart clears the previous run's timing and keeps the agenda", () => {
    let old = startSession(withItems(), NOW - 1_000_000);
    old = nextItem(old, NOW - 500_000);
    const s = applyLifecycle(old, "restart", NOW);
    expect(s.status).toBe("running");
    expect(s.currentIndex).toBe(0);
    expect(s.elapsedMs).toEqual([0, 0]);
    expect(s.items).toHaveLength(2);
    expect(s.runningSince).toBe(NOW);
  });

  it("reset goes back to setup without starting", () => {
    const s = applyLifecycle(startSession(withItems(), NOW - 1000), "reset", NOW);
    expect(s.status).toBe("setup");
    expect(s.items).toHaveLength(2);
  });

  it("none returns the same state", () => {
    const s = withItems();
    expect(applyLifecycle(s, "none", NOW)).toBe(s);
  });
});
