import type { SessionStore } from "../store/SessionStore";
import { useNow, useSession } from "../store/hooks";
import { formatClock, formatDelta } from "../core/format";
import { currentRemainingMs, currentTone, scheduleDeltaMs, totalElapsedMs } from "../core/timer";
import { AgendaBar } from "./AgendaBar";
import { DoneView } from "./DoneView";

/** What everyone sees when the app is shared to the meeting stage: a big, read-only version of the bar. */
export function StageView({ store }: { store: SessionStore }) {
  const state = useSession(store);
  const now = useNow(store);

  if (state.status === "done") {
    return <main className="app"><DoneView store={store} showControls={false} /></main>;
  }

  const item = state.items[state.currentIndex];
  const live = (state.status === "running" || state.status === "paused") && item;
  if (!live) {
    return (
      <main className="app stage">
        <h1>Meeting Facilitator</h1>
        <p className="muted">Waiting for the meeting to start…</p>
      </main>
    );
  }

  const tone = currentTone(state, now);
  const next = state.items[state.currentIndex + 1];

  return (
    <>
      <AgendaBar store={store} large />
      <main className="stage">
        <p className="muted">Item {state.currentIndex + 1} of {state.items.length}{state.status === "paused" ? " · paused" : ""}</p>
        <h1 className="stage-title">{item.title}</h1>
        <div className={`stage-clock tone-${tone}`}>{formatClock(currentRemainingMs(state, now))}</div>
        <p className="stage-meta">
          {formatDelta(scheduleDeltaMs(state, now))} · meeting {formatClock(totalElapsedMs(state, now))} of {state.totalMinutes}:00
        </p>
        {next && <p className="stage-next">Next: <strong>{next.title}</strong> ({next.minutes} min)</p>}
      </main>
    </>
  );
}
