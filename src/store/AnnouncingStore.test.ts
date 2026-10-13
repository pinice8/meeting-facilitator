import { describe, expect, it, vi } from "vitest";
import { AnnouncingStore } from "./AnnouncingStore";
import { MemoryStore } from "./MemoryStore";
import { goToItem, nextItem, pauseSession, previousItem, resetSession, resumeSession, startSession } from "../core/timer";
import { emptySession } from "../core/types";

const T0 = 1_000_000;
const initial = () => ({
  ...emptySession(30),
  items: [
    { id: "item-1", title: "Pod 1", minutes: 10, participants: ["Alice"] },
    { id: "item-2", title: "Pod 2", minutes: 10 },
    { id: "item-3", title: "Pod 3", minutes: 10, participants: ["Bob"] },
  ],
});

function setup(canControl = true) {
  const announce = vi.fn();
  const inner = new MemoryStore({ initial: initial(), clock: () => T0, canControl });
  return { store: new AnnouncingStore(inner, announce), announce, inner };
}
const titles = (announce: ReturnType<typeof vi.fn>) => announce.mock.calls.map(([item]) => item.title);

describe("AnnouncingStore", () => {
  it("announces the first item when the meeting starts, then each item with participants as it begins", () => {
    const { store, announce } = setup();
    store.update(startSession);
    expect(titles(announce)).toEqual(["Pod 1"]);
    store.update(nextItem); // Pod 2 has nobody
    expect(titles(announce)).toEqual(["Pod 1"]);
    store.update(nextItem);
    expect(titles(announce)).toEqual(["Pod 1", "Pod 3"]);
  });

  it("never announces the same item twice, even when going back and forth", () => {
    const { store, announce } = setup();
    store.update(startSession);
    store.update((s, n) => goToItem(s, 2, n));
    store.update(previousItem);
    store.update((s, n) => goToItem(s, 0, n));
    store.update((s, n) => goToItem(s, 2, n));
    expect(titles(announce)).toEqual(["Pod 1", "Pod 3"]);
  });

  it("records the announcement in the shared state in the same update", () => {
    const { store, inner } = setup();
    store.update(startSession);
    expect(inner.getState().announced).toEqual(["item-1"]);
  });

  it("waits for resume when the item is reached while paused", () => {
    const { store, announce } = setup();
    store.update(startSession);
    store.update(pauseSession);
    store.update((s, n) => goToItem(s, 2, n));
    expect(titles(announce)).toEqual(["Pod 1"]);
    store.update(resumeSession);
    expect(titles(announce)).toEqual(["Pod 1", "Pod 3"]);
  });

  it("announces again after the run is reset and started again", () => {
    const { store, announce } = setup();
    store.update(startSession);
    store.update(resetSession);
    store.update(startSession);
    expect(titles(announce)).toEqual(["Pod 1", "Pod 1"]);
  });

  it("does nothing for read-only users", () => {
    const { store, announce } = setup(false);
    store.update(startSession);
    expect(announce).not.toHaveBeenCalled();
  });

  it("does not announce when nothing changed", () => {
    const { store, announce } = setup();
    store.update((s) => s);
    expect(announce).not.toHaveBeenCalled();
  });
});
