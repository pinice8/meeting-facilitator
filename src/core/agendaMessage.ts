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

/** What the Power Automate flow receives: ready-made message text plus the raw data. */
export interface FlowPayload {
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
    chatId,
    message: agendaToHtml(items, totalMinutes),
    text: agendaToText(items, totalMinutes),
    totalMinutes,
    items: items.map((item) => ({ title: item.title, minutes: item.minutes, participants: item.participants ?? [] })),
  };
}
