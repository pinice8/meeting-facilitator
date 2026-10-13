import { describe, expect, it } from "vitest";
import { loadChatSettings, saveChatSettings, type KeyValueStorage } from "./chatSettings";

const fakeStorage = (initial: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } => {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
};

describe("chat settings", () => {
  it("starts empty", () => {
    expect(loadChatSettings(fakeStorage())).toEqual({ flowUrl: "", postOnSave: false, lastPosted: {} });
  });

  it("round-trips through storage", () => {
    const storage = fakeStorage();
    saveChatSettings(storage, { flowUrl: "https://flow/x", postOnSave: true, lastPosted: { chat1: "text" } });
    expect(loadChatSettings(storage)).toEqual({ flowUrl: "https://flow/x", postOnSave: true, lastPosted: { chat1: "text" } });
  });

  it("ignores corrupt or wrongly shaped saved data", () => {
    expect(loadChatSettings(fakeStorage({ "meeting-facilitator.chat": "{not json" }))).toEqual({ flowUrl: "", postOnSave: false, lastPosted: {} });
    expect(loadChatSettings(fakeStorage({ "meeting-facilitator.chat": JSON.stringify({ flowUrl: 5, postOnSave: "yes" }) }))).toEqual({
      flowUrl: "",
      postOnSave: false,
      lastPosted: {},
    });
  });

  it("survives storage that refuses writes", () => {
    const broken: KeyValueStorage = { getItem: () => null, setItem: () => { throw new Error("blocked"); } };
    expect(() => saveChatSettings(broken, { flowUrl: "", postOnSave: false, lastPosted: {} })).not.toThrow();
  });
});
