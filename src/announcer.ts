import { buildChatMessage, resolveParticipants, type ChatMember } from "./core/announce";
import type { AgendaItem } from "./core/types";
import { listChatMembers, sendChatMessage } from "./graph/chat";

export type AnnouncementStatus =
  | { kind: "idle" }
  | { kind: "sending"; title: string }
  | { kind: "sent"; title: string; tagged: string[]; unresolved: string[] }
  | { kind: "failed"; item: AgendaItem; error: string };

export interface AnnouncerDeps {
  /** A Graph token able to read chat members and send chat messages (may open the sign-in popup). */
  getToken: () => Promise<string>;
  chatId: string;
  fetchFn?: typeof fetch;
}

/**
 * Calls an item's participants into the meeting chat: finds them among the chat's members and posts
 * one message tagging them. Observable so the UI can show "tagged Alice, Bob" or the failure with Retry.
 */
export class Announcer {
  private status: AnnouncementStatus = { kind: "idle" };
  private readonly listeners = new Set<() => void>();
  private members: ChatMember[] | undefined;

  constructor(private readonly deps: AnnouncerDeps) {}

  getStatus = (): AnnouncementStatus => this.status;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async announce(item: AgendaItem): Promise<void> {
    if (!item.participants?.length) return;
    this.set({ kind: "sending", title: item.title });
    try {
      const token = await this.deps.getToken();
      this.members ??= await listChatMembers(token, this.deps.chatId, this.deps.fetchFn);
      const resolution = resolveParticipants(item.participants, this.members);
      if (resolution.mentioned.length === 0 && resolution.unresolved.length === 0) return this.set({ kind: "idle" });
      await sendChatMessage(token, this.deps.chatId, buildChatMessage(item, resolution), this.deps.fetchFn);
      this.set({
        kind: "sent",
        title: item.title,
        tagged: resolution.mentioned.map((m) => m.displayName),
        unresolved: resolution.unresolved,
      });
    } catch (error) {
      this.members = undefined; // refetch next time in case the failure was a stale token
      this.set({ kind: "failed", item, error: error instanceof Error ? error.message : String(error) });
    }
  }

  retry(): Promise<void> {
    return this.status.kind === "failed" ? this.announce(this.status.item) : Promise.resolve();
  }

  private set(status: AnnouncementStatus) {
    this.status = status;
    this.listeners.forEach((listener) => listener());
  }
}
