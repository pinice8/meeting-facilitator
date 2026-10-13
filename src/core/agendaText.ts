import { parseAgenda, type ParsedItem } from "./parser";
import type { AgendaItem } from "./types";

type Line = Pick<ParsedItem, "title" | "minutes" | "participants">;

const lineOf = (item: Line): string => {
  const main = item.minutes ? `${item.title} - ${item.minutes}` : item.title;
  return item.participants?.length ? `${main} | ${item.participants.join(", ")}` : main;
};

/** Canonical agenda text for saved items (one "Title - minutes" line each). */
export function itemsToText(items: AgendaItem[]): string {
  return items.map((item) => lineOf(item)).join("\n");
}

/** Rewrites the agenda text so that the item at `index` has explicit `minutes`; other lines keep their meaning. */
export function setMinutesInText(text: string, index: number, minutes: number): string {
  const parsed = parseAgenda(text);
  if (index < 0 || index >= parsed.length) return text;
  parsed[index] = { ...parsed[index], minutes };
  return parsed.map(lineOf).join("\n");
}

/** Rewrites the agenda text so that the item at `index` has the given participants ("Alice, Bob"; empty clears them). */
export function setParticipantsInText(text: string, index: number, participants: string): string {
  const parsed = parseAgenda(text);
  if (index < 0 || index >= parsed.length) return text;
  const names = participants.split(/[,;]/).map((n) => n.trim().replace(/^@/, "")).filter(Boolean);
  const { participants: _old, ...rest } = parsed[index];
  parsed[index] = names.length > 0 ? { ...rest, participants: names } : rest;
  return parsed.map(lineOf).join("\n");
}
