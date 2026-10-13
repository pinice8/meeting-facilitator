import type { SessionStore } from "../store/SessionStore";
import { useNow, useSession } from "../store/hooks";
import { formatClock } from "../core/format";
import { MINUTE_MS, currentRemainingMs, currentTone, elapsedOf } from "../core/timer";

/**
 * A bar pinned to the top of the view: the running item first (filling as its time passes),
 * then the upcoming items. Segment widths follow the planned minutes.
 */
export function AgendaBar({ store, large = false }: { store: SessionStore; large?: boolean }) {
  const state = useSession(store);
  const now = useNow(store);
  const current = state.items[state.currentIndex];
  if (!current) return null;

  const tone = currentTone(state, now);
  const progress = Math.min(1, elapsedOf(state, state.currentIndex, now) / (current.minutes * MINUTE_MS));
  const upcoming = state.items.slice(state.currentIndex + 1);

  return (
    <div className={`agenda-bar${large ? " agenda-bar-large" : ""}`} role="group" aria-label="Agenda progress">
      {state.currentIndex > 0 && (
        <div className="seg seg-done" title={`${state.currentIndex} item(s) done`}>✓ {state.currentIndex}</div>
      )}
      <div
        className={`seg seg-current tone-${tone}`}
        style={{ flex: `${current.minutes} 1 0` }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-label={current.title}
      >
        <div className="seg-fill" style={{ width: `${progress * 100}%` }} />
        <span className="seg-title">{current.title}</span>
        <span className="seg-time">{state.status === "paused" ? "paused" : formatClock(currentRemainingMs(state, now))}</span>
      </div>
      {upcoming.map((item) => (
        <div key={item.id} className="seg seg-upcoming" style={{ flex: `${item.minutes} 1 0` }} title={`${item.title} (${item.minutes} min)`}>
          <span className="seg-title">{item.title}</span>
          <span className="seg-time">{item.minutes}m</span>
        </div>
      ))}
    </div>
  );
}
