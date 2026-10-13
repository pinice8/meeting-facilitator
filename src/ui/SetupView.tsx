import { useMemo, useRef, useState } from "react";
import type { SessionStore } from "../store/SessionStore";
import { useSession } from "../store/hooks";
import { parseAgenda } from "../core/parser";
import { planAgenda } from "../core/planner";
import { blankRows, itemsToRows, moveRow, parsedToRows, rowsToParsed, type Row } from "../core/rows";
import { setAgenda, startSession } from "../core/timer";

export interface InviteResult {
  agenda: string;
  totalMinutes?: number;
}
export type InviteLoader = () => Promise<InviteResult>;

interface Props {
  store: SessionStore;
  loadInvite?: InviteLoader;
  inMeeting?: boolean;
}

const START_ROWS = 3;

export function SetupView({ store, loadInvite, inMeeting = false }: Props) {
  const saved = useSession(store);
  const keys = useRef(0);
  const nextKey = () => ++keys.current;

  const [rows, setRows] = useState<Row[]>(() =>
    saved.items.length > 0 ? itemsToRows(saved.items, nextKey) : blankRows(START_ROWS, nextKey),
  );
  const [total, setTotal] = useState(saved.totalMinutes);
  const [pasted, setPasted] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [justSaved, setJustSaved] = useState(false);
  const [focusKey, setFocusKey] = useState<number>();

  const plan = useMemo(() => planAgenda(rowsToParsed(rows), total), [rows, total]);
  const canStart = plan.items.length > 0 && plan.overByMinutes === 0 && total > 0;

  // What the planner decided for each named row, so rows without minutes can show their share.
  const plannedMinutes = useMemo(() => {
    const byKey = new Map<number, number>();
    let index = 0;
    for (const row of rows) if (row.title.trim() !== "") byKey.set(row.key, plan.items[index++]?.minutes ?? 0);
    return byKey;
  }, [rows, plan]);

  if (!store.canControl) {
    return (
      <section>
        <h2>Agenda</h2>
        {saved.items.length === 0 ? (
          <p className="muted">Waiting for the organizer to set up the agenda.</p>
        ) : (
          <>
            <ol className="agenda">
              {saved.items.map((item) => (
                <li key={item.id}>
                  <span>
                    {item.title}
                    {item.participants?.length ? <span className="who"> · {item.participants.join(", ")}</span> : null}
                  </span>
                  <span className="minutes">{item.minutes} min</span>
                </li>
              ))}
            </ol>
            <p className="muted">{saved.totalMinutes} minutes in total. Waiting for the organizer to start.</p>
          </>
        )}
      </section>
    );
  }

  const change = (update: (current: Row[]) => Row[]) => {
    setRows(update);
    setJustSaved(false);
  };
  const patch = (key: number, changes: Partial<Row>) =>
    change((current) => current.map((row) => (row.key === key ? { ...row, ...changes } : row)));

  const addRow = () => {
    const key = nextKey();
    setFocusKey(key);
    change((current) => [...current, { key, title: "", participants: "" }]);
  };

  const replaceWithText = (text: string, minutes?: number) => {
    const parsed = parseAgenda(text);
    if (parsed.length === 0) return;
    change(() => parsedToRows(parsed, nextKey));
    if (minutes) setTotal(minutes);
    setPasted("");
  };

  const onLoadInvite = async () => {
    if (!loadInvite) return;
    setLoading(true);
    setError(undefined);
    try {
      const result = await loadInvite();
      if (parseAgenda(result.agenda).length === 0) throw new Error("The invite has no agenda text");
      replaceWithText(result.agenda, result.totalMinutes);
    } catch (e) {
      setError(`${e instanceof Error ? e.message : String(e)}. You can add the items below instead.`);
    } finally {
      setLoading(false);
    }
  };

  const save = () => {
    store.update((s) => setAgenda(s, plan.items, total));
    setJustSaved(true);
  };
  const start = () => store.update((s, now) => startSession(setAgenda(s, plan.items, total), now));

  return (
    <section>
      <h2>Agenda</h2>

      <div className="row">
        <label className="inline">
          Meeting length
          <input
            type="number"
            min={1}
            max={480}
            value={total}
            onChange={(e) => {
              setTotal(Math.max(1, Number(e.target.value) || 1));
              setJustSaved(false);
            }}
          />
          min
        </label>
        {loadInvite && (
          <button type="button" onClick={onLoadInvite} disabled={loading}>
            {loading ? "Loading…" : "Load from invite"}
          </button>
        )}
      </div>
      {error && <p className="error" role="alert">{error}</p>}

      <table className="plan">
        <thead>
          <tr><th>#</th><th>Item</th><th>Min</th><th><span className="sr-only">Actions</span></th></tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.key}>
              <td>{i + 1}</td>
              <td>
                <div className="cell-stack">
                  <input
                    className="title-input"
                    aria-label={`Name of item ${i + 1}`}
                    placeholder="Item name"
                    value={row.title}
                    autoFocus={row.key === focusKey}
                    onChange={(e) => patch(row.key, { title: e.target.value })}
                  />
                  <input
                    className="who-input"
                    aria-label={`Participants for item ${i + 1}`}
                    placeholder="Participants (optional)"
                    value={row.participants}
                    onChange={(e) => patch(row.key, { participants: e.target.value })}
                  />
                </div>
              </td>
              <td>
                <input
                  type="number"
                  min={1}
                  max={240}
                  aria-label={`Minutes for item ${i + 1}`}
                  placeholder={plannedMinutes.has(row.key) ? String(plannedMinutes.get(row.key)) : ""}
                  value={row.minutes ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    patch(row.key, { minutes: raw === "" ? undefined : Math.min(240, Math.max(1, Math.round(Number(raw)))) });
                  }}
                />
              </td>
              <td className="row-actions">
                <button type="button" aria-label={`Move item ${i + 1} up`} disabled={i === 0} onClick={() => change((c) => moveRow(c, i, -1))}>↑</button>
                <button type="button" aria-label={`Move item ${i + 1} down`} disabled={i === rows.length - 1} onClick={() => change((c) => moveRow(c, i, 1))}>↓</button>
                <button type="button" aria-label={`Remove item ${i + 1}`} onClick={() => change((c) => c.filter((r) => r.key !== row.key))}>✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row">
        <button type="button" onClick={addRow}>+ Add item</button>
        <span className="muted">Leave minutes empty to share the remaining time.</span>
      </div>

      <details className="paste">
        <summary>Paste a whole agenda instead</summary>
        <p className="muted">One item per line. Add minutes like “Demo - 10” or “Demo (10 min)”, and participants after a bar: “Demo - 10 | Alice, Bob”.</p>
        <textarea value={pasted} rows={5} onChange={(e) => setPasted(e.target.value)} placeholder={"Intro - 5\nDemo | Alice\nQ&A"} />
        <div className="row">
          <button type="button" onClick={() => replaceWithText(pasted)} disabled={parseAgenda(pasted).length === 0}>
            Replace the items above
          </button>
        </div>
      </details>

      {plan.overByMinutes > 0 && (
        <p className="error" role="alert">The plan is {plan.overByMinutes} min over the meeting length. Shorten an item or extend the meeting.</p>
      )}
      {plan.overByMinutes === 0 && plan.items.length > 0 && plan.unassignedMinutes > 0 && (
        <p className="muted">{plan.unassignedMinutes} min of the meeting aren’t assigned to any item.</p>
      )}

      <div className="row">
        <button type="button" onClick={save} disabled={!canStart}>Save agenda</button>
        <button type="button" className={inMeeting ? "primary" : ""} onClick={start} disabled={!canStart}>
          {inMeeting ? "Start meeting" : "Start now"}
        </button>
        {justSaved && <span className="muted">Saved — everyone in the meeting can see it.</span>}
      </div>
      {!inMeeting && (
        <p className="muted">Once saved, the meeting starts by itself when you open this app inside the meeting.</p>
      )}
    </section>
  );
}
