import { useState } from "react";
import type { SessionStore } from "../store/SessionStore";
import { useNow, useSession } from "../store/hooks";
import { formatClock, formatDelta } from "../core/format";
import { applyLifecycle } from "../core/lifecycle";
import {
  currentRemainingMs,
  currentTone,
  elapsedOf,
  finishSession,
  nextItem,
  pauseSession,
  previousItem,
  resumeSession,
  scheduleDeltaMs,
  totalElapsedMs,
} from "../core/timer";

interface Props {
  store: SessionStore;
  onShareToStage?: () => Promise<void>;
}

export function RunningView({ store, onShareToStage }: Props) {
  const state = useSession(store);
  const [shareMessage, setShareMessage] = useState<string>();
  const now = useNow(store);
  const item = state.items[state.currentIndex];
  if (!item) return null;

  const isLast = state.currentIndex === state.items.length - 1;
  const paused = state.status === "paused";
  const remaining = currentRemainingMs(state, now);
  const tone = currentTone(state, now);
  const delta = scheduleDeltaMs(state, now);

  return (
    <section>
      <p className="muted">Item {state.currentIndex + 1} of {state.items.length} · {item.minutes} min planned{paused ? " · paused" : ""}</p>
      <h2 className="current-title">{item.title}</h2>

      <div className={`clock tone-${tone}`} aria-live="off">{formatClock(remaining)}</div>
      {tone === "over" && <p className="banner" role="alert">Time’s up on “{item.title}”.</p>}

      <p className="muted">
        {formatDelta(delta)} · meeting {formatClock(totalElapsedMs(state, now))} of {state.totalMinutes}:00
      </p>

      {store.canControl && (
        <div className="row controls">
          <button type="button" onClick={() => store.update(previousItem)} disabled={state.currentIndex === 0}>Previous</button>
          {paused ? (
            <button type="button" onClick={() => store.update(resumeSession)}>Resume</button>
          ) : (
            <button type="button" onClick={() => store.update(pauseSession)}>Pause</button>
          )}
          <button type="button" className="primary" onClick={() => store.update(nextItem)}>{isLast ? "Finish" : "Next"}</button>
          <button type="button" onClick={() => store.update(finishSession)}>End session</button>
          <button type="button" onClick={() => store.update((s, now) => applyLifecycle(s, "restart", now))} title="Start the agenda again from item 1">Restart</button>
        </div>
      )}
      {onShareToStage && (
        <div className="row">
          <button
            type="button"
            onClick={() => {
              setShareMessage(undefined);
              onShareToStage().catch((e: Error) => setShareMessage(`Couldn’t share to the stage: ${e.message}`));
            }}
          >
            Show on stage
          </button>
          {shareMessage && <span className="muted" role="status">{shareMessage}</span>}
        </div>
      )}

      <ol className="agenda">
        {state.items.map((entry, i) => {
          const status = i < state.currentIndex ? "done" : i === state.currentIndex ? "current" : "upcoming";
          const actual = elapsedOf(state, i, now);
          return (
            <li key={entry.id} className={`agenda-${status}`} aria-current={status === "current" ? "step" : undefined}>
              <span>
                {status === "done" ? "✓ " : status === "current" ? "▶ " : ""}
                {entry.title}
                {entry.participants?.length ? <span className="who"> · {entry.participants.join(", ")}</span> : null}
              </span>
              <span className="minutes">
                {status === "done" ? `${formatClock(actual)} / ${entry.minutes} min` : `${entry.minutes} min`}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
