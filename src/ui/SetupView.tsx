import { useMemo, useState } from "react";
import type { SessionStore } from "../store/SessionStore";
import { useSession } from "../store/hooks";
import { parseAgenda } from "../core/parser";
import { planAgenda } from "../core/planner";
import { itemsToText, setMinutesInText, setParticipantsInText } from "../core/agendaText";
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
  /** Participants get tagged in the meeting chat when their item starts. */
  canNotify?: boolean;
}

export function SetupView({ store, loadInvite, inMeeting = false, canNotify = false }: Props) {
  const saved = useSession(store);
  const [text, setText] = useState(() => itemsToText(saved.items));
  const [total, setTotal] = useState(saved.totalMinutes);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [justSaved, setJustSaved] = useState(false);

  const plan = useMemo(() => planAgenda(parseAgenda(text), total), [text, total]);
  const canStart = plan.items.length > 0 && plan.overByMinutes === 0 && total > 0;

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

  const edit = (next: string) => {
    setText(next);
    setJustSaved(false);
  };

  const onLoadInvite = async () => {
    if (!loadInvite) return;
    setLoading(true);
    setError(undefined);
    try {
      const result = await loadInvite();
      if (!result.agenda.trim()) throw new Error("The invite has no agenda text. Paste it below instead.");
      edit(result.agenda);
      if (result.totalMinutes) setTotal(result.totalMinutes);
    } catch (e) {
      setError(`${e instanceof Error ? e.message : String(e)}. You can paste the agenda instead.`);
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
      <label className="field">
        <span>One item per line. Add minutes like “Demo - 10” or “Demo (10 min)”.</span>
        <textarea value={text} rows={6} onChange={(e) => edit(e.target.value)} placeholder={"Intro - 5\nDemo\nQ&A"} />
      </label>

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
        {loadInvite ? (
          <button type="button" onClick={onLoadInvite} disabled={loading}>
            {loading ? "Loading…" : "Load from invite"}
          </button>
        ) : (
          <span className="muted">Paste your agenda (reading the invite isn’t set up).</span>
        )}
      </div>
      {error && <p className="error" role="alert">{error}</p>}

      {plan.items.length > 0 && (
        <table className="plan">
          <thead>
            <tr><th>#</th><th>Item</th><th>Minutes</th><th>Participants</th></tr>
          </thead>
          <tbody>
            {plan.items.map((item, i) => (
              <tr key={item.id}>
                <td>{i + 1}</td>
                <td>{item.title}</td>
                <td>
                  <input
                    aria-label={`Minutes for ${item.title}`}
                    type="number"
                    min={1}
                    max={240}
                    value={item.minutes}
                    onChange={(e) => edit(setMinutesInText(text, i, Math.max(1, Number(e.target.value) || 1)))}
                  />
                </td>
                <td>
                  {/* Uncontrolled + commit on blur/Enter: rewriting the text on every keystroke would eat the commas being typed. */}
                  <input
                    key={`${item.id}:${item.participants?.join(", ") ?? ""}`}
                    className="who-input"
                    aria-label={`Participants for ${item.title}`}
                    placeholder="Alice, Bob"
                    defaultValue={item.participants?.join(", ") ?? ""}
                    onBlur={(e) => {
                      if (e.target.value !== (item.participants?.join(", ") ?? "")) edit(setParticipantsInText(text, i, e.target.value));
                    }}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {plan.items.some((item) => item.participants?.length) && !canNotify && (
        <p className="muted">Participants are saved, but nobody will be tagged in the meeting chat until sign-in is set up (see the README).</p>
      )}
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
