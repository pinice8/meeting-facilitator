import { describe, expect, it } from "vitest";
import { RUN_STALE_MS, applyLifecycle, lifecycleAction } from "./lifecycle";
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
const ctx = (over: Partial<Parameters<typeof lifecycleAction>[1]> = {}) => ({
  inMeeting: true,
  canControl: true,
  lastActiveAt: undefined,
  now: NOW,
  ...over,
});

describe("lifecycleAction", () => {
  it("starts a saved agenda when a facilitator opens the app in the meeting", () => {
    expect(lifecycleAction(withItems(), ctx())).toBe("start");
  });

  it("does nothing before the meeting (pre-meeting chat tab)", () => {
    expect(lifecycleAction(withItems(), ctx({ inMeeting: false }))).toBe("none");
  });

  it("does nothing for attendees", () => {
    expect(lifecycleAction(withItems(), ctx({ canControl: false }))).toBe("none");
  });

  it("does nothing without an agenda", () => {
    expect(lifecycleAction(emptySession(), ctx())).toBe("none");
  });

  it("joins a run in progress when the heartbeat is recent", () => {
    const running = startSession(withItems(), NOW - 60_000);
    expect(lifecycleAction(running, ctx({ lastActiveAt: NOW - 30_000 }))).toBe("none");
  });

  it("restarts when the saved run's heartbeat is stale (the meeting ended and started again)", () => {
    const running = startSession(withItems(), NOW - 60 * 60_000);
    expect(lifecycleAction(running, ctx({ lastActiveAt: NOW - RUN_STALE_MS - 1 }))).toBe("restart");
  });

  it("restarts a finished run that nobody has touched for a while", () => {
    let done = startSession(withItems(), NOW - 3_600_000);
    done = nextItem(nextItem(done, NOW - 3_000_000), NOW - 2_000_000);
    expect(done.status).toBe("done");
    expect(lifecycleAction(done, ctx({ lastActiveAt: NOW - 1_000_000 }))).toBe("restart");
  });

  it("treats a run with no heartbeat at all as stale", () => {
    expect(lifecycleAction(startSession(withItems(), NOW - 1000), ctx())).toBe("restart");
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

  it("none returns the same state", () => {
    const s = withItems();
    expect(applyLifecycle(s, "none", NOW)).toBe(s);
  });
});
