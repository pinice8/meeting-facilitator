import { useCallback, useMemo, useRef, useState } from "react";
import { buildFlowPayload } from "../core/agendaMessage";
import type { AgendaItem } from "../core/types";
import { isFlowUrl, postAgendaToFlow } from "../chatPost";
import { defaultStorage, loadChatSettings, saveChatSettings, type ChatSettings, type KeyValueStorage } from "../chatSettings";

export type ChatStatus =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; confirmed: boolean }
  | { kind: "failed"; error: string };

export interface ChatOptions {
  /** The meeting's chat id from Teams (the flow needs it to know where to post). */
  chatId?: string;
  fetchFn?: typeof fetch;
  storage?: KeyValueStorage;
}

export interface AgendaChat {
  settings: ChatSettings;
  status: ChatStatus;
  setFlowUrl(url: string): void;
  setPostOnSave(on: boolean): void;
  /** Posts the agenda to the flow. Skips an agenda that was already posted unless `force`. */
  post(items: AgendaItem[], totalMinutes: number, force?: boolean): Promise<void>;
  /** Posts only when the "post when I save" setting is on. */
  postIfEnabled(items: AgendaItem[], totalMinutes: number): Promise<void>;
}

/** Posting the agenda to the meeting chat through the user's own Power Automate flow. */
export function useAgendaChat({ chatId, fetchFn, storage }: ChatOptions = {}): AgendaChat {
  const store = useMemo(() => storage ?? defaultStorage(), [storage]);
  const [settings, setSettings] = useState(() => loadChatSettings(store));
  const [status, setStatus] = useState<ChatStatus>({ kind: "idle" });
  const latest = useRef(settings);
  latest.current = settings;

  const update = useCallback(
    (changes: Partial<ChatSettings>) => {
      const next = { ...latest.current, ...changes };
      latest.current = next;
      setSettings(next);
      saveChatSettings(store, next);
    },
    [store],
  );

  const post = useCallback(
    async (items: AgendaItem[], totalMinutes: number, force = false) => {
      const { flowUrl, lastPosted } = latest.current;
      if (items.length === 0 || !isFlowUrl(flowUrl)) return;
      const payload = buildFlowPayload(items, totalMinutes, chatId);
      const chatKey = chatId ?? "local";
      if (!force && lastPosted[chatKey] === payload.text) return;
      setStatus({ kind: "sending" });
      try {
        const result = await postAgendaToFlow(flowUrl, payload, fetchFn);
        update({ lastPosted: { ...latest.current.lastPosted, [chatKey]: payload.text } });
        setStatus({ kind: "sent", confirmed: result === "confirmed" });
      } catch (error) {
        setStatus({ kind: "failed", error: error instanceof Error ? error.message : String(error) });
      }
    },
    [chatId, fetchFn, update],
  );

  const postIfEnabled = useCallback(
    (items: AgendaItem[], totalMinutes: number) => (latest.current.postOnSave ? post(items, totalMinutes) : Promise.resolve()),
    [post],
  );

  return {
    settings,
    status,
    setFlowUrl: (flowUrl) => update({ flowUrl: flowUrl.trim() }),
    setPostOnSave: (postOnSave) => update({ postOnSave }),
    post,
    postIfEnabled,
  };
}
