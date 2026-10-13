import type { AgendaItem } from "./types";

export interface ChatMember {
  userId: string;
  displayName: string;
  email?: string;
}

export interface Resolution {
  mentioned: ChatMember[];
  /** Names we could not match to exactly one chat member (not in the chat, or ambiguous). */
  unresolved: string[];
}

const norm = (text: string) => text.trim().replace(/^@/, "").toLowerCase();

/** Finds the single chat member a token refers to; tries the most specific match first. */
function matchOne(token: string, members: ChatMember[]): ChatMember | undefined {
  const t = norm(token);
  if (!t) return undefined;
  const levels: Array<(m: ChatMember) => boolean> = [
    (m) => m.email?.toLowerCase() === t,
    (m) => norm(m.displayName) === t,
    (m) => norm(m.displayName).split(/\s+/).some((word) => word.startsWith(t)) || norm(m.displayName).startsWith(t),
    (m) => norm(m.displayName).includes(t),
  ];
  for (const test of levels) {
    const hits = members.filter(test);
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) return undefined; // ambiguous: better to say so than tag the wrong person
  }
  return undefined;
}

export function resolveParticipants(names: string[], members: ChatMember[]): Resolution {
  const mentioned: ChatMember[] = [];
  const unresolved: string[] = [];
  for (const name of names) {
    const member = matchOne(name, members);
    if (!member) unresolved.push(name);
    else if (!mentioned.some((m) => m.userId === member.userId)) mentioned.push(member);
  }
  return { mentioned, unresolved };
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface ChatMessage {
  body: { contentType: "html"; content: string };
  mentions: Array<{
    id: number;
    mentionText: string;
    mentioned: { user: { id: string; displayName: string; userIdentityType: "aadUser" } };
  }>;
}

/** The chat message that calls the item's participants in (Graph chatMessage with @mentions). */
export function buildChatMessage(item: AgendaItem, resolution: Resolution): ChatMessage {
  const tags = resolution.mentioned.map((m, i) => `<at id="${i}">${escapeHtml(m.displayName)}</at>`);
  const plain = resolution.unresolved.map((name) => escapeHtml(`@${name}`));
  const who = [...tags, ...plain].join(", ");
  const content = `${who} — it’s your turn to join: <b>${escapeHtml(item.title)}</b> (${item.minutes} min)`;
  return {
    body: { contentType: "html", content },
    mentions: resolution.mentioned.map((m, i) => ({
      id: i,
      mentionText: m.displayName,
      mentioned: { user: { id: m.userId, displayName: m.displayName, userIdentityType: "aadUser" } },
    })),
  };
}
