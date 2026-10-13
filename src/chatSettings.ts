/** Per-device chat settings. The flow URL works like a password, so it lives only in this browser's storage. */
export interface ChatSettings {
  flowUrl: string;
  postOnSave: boolean;
  /** The last agenda text posted for each chat, so the same agenda is never posted twice. */
  lastPosted: Record<string, string>;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = "meeting-facilitator.chat";
const memory = new Map<string, string>();
const memoryStorage: KeyValueStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => void memory.set(key, value),
};

/** localStorage when the host allows it, otherwise memory for this page load. */
export function defaultStorage(): KeyValueStorage {
  try {
    const probe = "__probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return memoryStorage;
  }
}

export function loadChatSettings(storage: KeyValueStorage): ChatSettings {
  const empty: ChatSettings = { flowUrl: "", postOnSave: false, lastPosted: {} };
  try {
    const saved = JSON.parse(storage.getItem(KEY) ?? "{}") as Partial<ChatSettings>;
    return {
      flowUrl: typeof saved.flowUrl === "string" ? saved.flowUrl : "",
      postOnSave: saved.postOnSave === true,
      lastPosted: saved.lastPosted && typeof saved.lastPosted === "object" ? saved.lastPosted : {},
    };
  } catch {
    return empty;
  }
}

export function saveChatSettings(storage: KeyValueStorage, settings: ChatSettings): void {
  try {
    storage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* storage full or blocked: settings last for this page load only */
  }
}
