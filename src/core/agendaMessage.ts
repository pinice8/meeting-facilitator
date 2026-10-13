import type { AgendaItem } from "./types";

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const lineFor = (item: AgendaItem, index: number): string =>
  `${index + 1}. ${item.title} (${item.minutes} min)${item.participants?.length ? ` — ${item.participants.join(", ")}` : ""}`;

const headingFor = (totalMinutes: number): string => `📋 Agenda — ${totalMinutes} min`;

/** The agenda as plain text, for copying into a chat. */
export function agendaToText(items: AgendaItem[], totalMinutes: number): string {
  return [headingFor(totalMinutes), ...items.map(lineFor)].join("\n");
}

/** The same agenda as chat-ready HTML (Teams chat understands <b> and <br>). */
export function agendaToHtml(items: AgendaItem[], totalMinutes: number): string {
  return [`<b>${escapeHtml(headingFor(totalMinutes))}</b>`, ...items.map((item, i) => escapeHtml(lineFor(item, i)))].join("<br>");
}

/** The agenda as an Adaptive Card, the body shape the Teams webhook trigger expects. */
export function agendaToCard(items: AgendaItem[], totalMinutes: number) {
  return {
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    type: "AdaptiveCard" as const,
    version: "1.4",
    body: [
      { type: "TextBlock" as const, text: headingFor(totalMinutes), weight: "Bolder", size: "Medium", wrap: true },
      ...items.map((item, i) => ({ type: "TextBlock" as const, text: lineFor(item, i), wrap: true })),
    ],
  };
}

/**
 * What the Power Automate flow receives. It is a Teams "message with an adaptive card" (so the Teams
 * webhook trigger accepts it as is) plus our own fields: ready-made message text and the raw data.
 */
export interface FlowPayload {
  type: "message";
  attachments: Array<{ contentType: string; contentUrl: null; content: ReturnType<typeof agendaToCard> }>;
  chatId: string;
  /** HTML message to post. */
  message: string;
  /** Plain-text version of the same message. */
  text: string;
  totalMinutes: number;
  items: Array<{ title: string; minutes: number; participants: string[] }>;
}

export function buildFlowPayload(items: AgendaItem[], totalMinutes: number, chatId = ""): FlowPayload {
  return {
    type: "message",
    attachments: [{ contentType: "application/vnd.microsoft.card.adaptive", contentUrl: null, content: agendaToCard(items, totalMinutes) }],
    chatId,
    message: agendaToHtml(items, totalMinutes),
    text: agendaToText(items, totalMinutes),
    totalMinutes,
    items: items.map((item) => ({ title: item.title, minutes: item.minutes, participants: item.participants ?? [] })),
  };
}
