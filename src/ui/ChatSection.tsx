import { useState } from "react";
import { agendaToText } from "../core/agendaMessage";
import type { AgendaItem } from "../core/types";
import { isFlowUrl } from "../chatPost";
import type { AgendaChat } from "./useAgendaChat";

/** One line saying what happened the last time the agenda was posted to the chat. */
export function ChatStatusLine({ chat }: { chat: AgendaChat }) {
  const { status } = chat;
  if (status.kind === "idle") return null;
  if (status.kind === "sending") return <p className="muted" role="status">Posting the agenda to the meeting chat…</p>;
  if (status.kind === "sent") return <p className="muted" role="status">Sent the agenda to your flow. It should appear in the meeting chat in a few seconds.</p>;
  return <p className="error" role="alert">Couldn’t post the agenda: {status.error}</p>;
}

interface Props {
  chat: AgendaChat;
  items: AgendaItem[];
  totalMinutes: number;
}

/** Two ways to get the agenda into the meeting chat: copy it, or post it through the user's own flow. */
export function ChatSection({ chat, items, totalMinutes }: Props) {
  const [copyMessage, setCopyMessage] = useState<string>();
  const text = agendaToText(items, totalMinutes);
  const hasItems = items.length > 0;
  const { flowUrl, postOnSave } = chat.settings;
  const urlProblem = flowUrl !== "" && !isFlowUrl(flowUrl);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage("Copied. Paste it in the meeting chat.");
    } catch {
      setCopyMessage("Couldn’t copy automatically. Select the text above and copy it.");
    }
  };

  return (
    <details className="paste">
      <summary>Share the agenda in the meeting chat</summary>

      <p className="muted">Copy it and paste it into the chat yourself:</p>
      <textarea readOnly rows={Math.min(8, items.length + 2)} value={hasItems ? text : "Add items to the table first."} aria-label="Agenda as text" onFocus={(e) => e.currentTarget.select()} />
      <div className="row">
        <button type="button" onClick={copy} disabled={!hasItems}>Copy agenda</button>
        {copyMessage && <span className="muted" role="status">{copyMessage}</span>}
      </div>

      <p className="muted">Or post it automatically through your own Power Automate flow (set up once; see the README):</p>
      <label className="field">
        <span>Flow URL (kept only on this device)</span>
        <input type="password" autoComplete="off" placeholder="https://…" value={flowUrl} onChange={(e) => chat.setFlowUrl(e.target.value)} />
      </label>
      {urlProblem && <p className="error" role="alert">That doesn’t look like a flow URL (it should start with https://).</p>}
      <label className="inline">
        <input type="checkbox" checked={postOnSave} onChange={(e) => chat.setPostOnSave(e.target.checked)} />
        Post the agenda to the meeting chat when I save
      </label>
      <div className="row">
        <button type="button" onClick={() => void chat.post(items, totalMinutes, true)} disabled={!hasItems || !isFlowUrl(flowUrl)}>
          Post now
        </button>
      </div>
    </details>
  );
}
