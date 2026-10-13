import type { SessionStore } from "../store/SessionStore";
import { useNow, useSession } from "../store/hooks";
import { formatClock } from "../core/format";
import { MINUTE_MS, currentRemainingMs, currentTone, elapsedOf, goToItem } from "../core/timer";

interface Props {
  store: SessionStore;
  variant?: "panel" | "large";
  /** Facilitators can click an item to jump to it; the read-only stage view cannot. */
  interactive?: boolean;
}

/**
 * A bar pinned to the top of the view: finished items as small chips, the running item
 * (filling as its time passes), then the upcoming items. Widths follow the planned minutes.
 */
export function AgendaBar({ store, variant = "panel", interactive = false }: Props) {
  const state = useSession(store);
  const now = useNow(store);
  const current = state.items[state.currentIndex];
  if (!current) return null;

  const clickable = interactive && store.canControl;
  const jump = (index: number) => store.update((s, n) => goToItem(s, index, n));
  const tone = currentTone(state, now);
  const progress = Math.min(1, elapsedOf(state, state.currentIndex, now) / (current.minutes * MINUTE_MS));

  const segment = (index: number, className: string, style: React.CSSProperties | undefined, title: string, children: React.ReactNode) =>
    clickable ? (
      <button key={state.items[index].id} type="button" className={`seg seg-button ${className}`} style={style} title={title} aria-label={`Go to ${state.items[index].title}`} onClick={() => jump(index)}>
        {children}
      </button>
    ) : (
      <div key={state.items[index].id} className={`seg ${className}`} style={style} title={title}>
        {children}
      </div>
    );

  return (
    <div className={`agenda-bar${variant === "panel" ? "" : ` agenda-bar-${variant}`}`} role="group" aria-label="Agenda progress">
      {state.items.map((item, index) => {
        if (index < state.currentIndex) {
          return segment(index, "seg-done", undefined, `${item.title} (done)`, <>✓ {index + 1}</>);
        }
        if (index === state.currentIndex) {
          return (
            <div
              key={item.id}
              className={`seg seg-current tone-${tone}`}
              style={{ flex: `${item.minutes} 1 0` }}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
              aria-label={item.title}
            >
              <div className="seg-fill" style={{ width: `${progress * 100}%` }} />
              <span className="seg-title">{item.title}</span>
              <span className="seg-time">{state.status === "paused" ? "paused" : formatClock(currentRemainingMs(state, now))}</span>
            </div>
          );
        }
        return segment(
          index,
          "seg-upcoming",
          { flex: `${item.minutes} 1 0` },
          `${item.title} (${item.minutes} min)`,
          <>
            <span className="seg-title">{item.title}</span>
            <span className="seg-time">{item.minutes}m</span>
          </>,
        );
      })}
    </div>
  );
}
