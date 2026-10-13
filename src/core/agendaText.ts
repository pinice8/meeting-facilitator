import { parseAgenda, type ParsedItem } from "./parser";
import type { AgendaItem } from "./types";

const lineOf = (item: ParsedItem): string => (item.minutes ? `${item.title} - ${item.minutes}` : item.title);

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
