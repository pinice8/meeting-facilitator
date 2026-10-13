import type { SessionStore } from "../store/SessionStore";
import { useSession } from "../store/hooks";
import { formatClock } from "../core/format";
import { MINUTE_MS, resetSession } from "../core/timer";

export function DoneView({ store, showControls = true }: { store: SessionStore; showControls?: boolean }) {
  const state = useSession(store);
  const rows = state.items.map((item, i) => {
    const actual = state.elapsedMs[i] ?? 0;
    return { item, actual, delta: actual - item.minutes * MINUTE_MS };
  });
  const plannedTotal = state.items.reduce((sum, item) => sum + item.minutes * MINUTE_MS, 0);
  const actualTotal = rows.reduce((sum, row) => sum + row.actual, 0);

  return (
    <section>
      <h2>Session finished</h2>
      <table className="plan">
        <thead>
          <tr><th>Item</th><th>Planned</th><th>Actual</th><th>Difference</th></tr>
        </thead>
        <tbody>
          {rows.map(({ item, actual, delta }) => (
            <tr key={item.id}>
              <td>{item.title}</td>
              <td>{item.minutes}:00</td>
              <td>{formatClock(actual)}</td>
              <td className={delta > 0 ? "tone-over" : ""}>{delta > 0 ? "+" : ""}{formatClock(delta)}</td>
            </tr>
          ))}
          <tr className="total">
            <td>Total</td>
            <td>{formatClock(plannedTotal)}</td>
            <td>{formatClock(actualTotal)}</td>
            <td>{formatClock(actualTotal - plannedTotal)}</td>
          </tr>
        </tbody>
      </table>
      {showControls && store.canControl && (
        <div className="row">
          <button type="button" onClick={() => store.update((s) => resetSession(s))}>Back to setup</button>
        </div>
      )}
    </section>
  );
}
