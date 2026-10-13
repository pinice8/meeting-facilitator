import { splitNames, type ParsedItem } from "./parser";
import type { AgendaItem } from "./types";

/** One row of the setup table while it is being edited. */
export interface Row {
  key: number;
  title: string;
  /** Explicit minutes; undefined means "share what is left" (the planner decides). */
  minutes?: number;
  /** Raw text as typed ("Alice, Bob"). */
  participants: string;
}

/** Rows with a name become agenda lines for the planner; blank rows are just empty space. */
export function rowsToParsed(rows: Row[]): ParsedItem[] {
  return rows
    .filter((row) => row.title.trim() !== "")
    .map((row) => {
      const participants = splitNames(row.participants);
      return {
        title: row.title.trim(),
        ...(row.minutes !== undefined ? { minutes: row.minutes } : {}),
        ...(participants.length > 0 ? { participants } : {}),
      };
    });
}

export function parsedToRows(parsed: ParsedItem[], nextKey: () => number): Row[] {
  return parsed.map((item) => ({
    key: nextKey(),
    title: item.title,
    minutes: item.minutes,
    participants: item.participants?.join(", ") ?? "",
  }));
}

export function itemsToRows(items: AgendaItem[], nextKey: () => number): Row[] {
  return parsedToRows(items, nextKey);
}

export function blankRows(count: number, nextKey: () => number): Row[] {
  return Array.from({ length: count }, () => ({ key: nextKey(), title: "", participants: "" }));
}

/** Moves the element at `index` one step up (-1) or down (+1); out-of-range moves change nothing. */
export function moveRow<T>(list: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
