import type { AgendaItem } from "./types";
import type { ParsedItem } from "./parser";

export interface PlanSummary {
  assignedMinutes: number;
  /** Minutes by which the plan exceeds the meeting length (0 when it fits). */
  overByMinutes: number;
  /** Minutes of the meeting not covered by any item (0 when fully used or over). */
  unassignedMinutes: number;
}

export interface PlanResult extends PlanSummary {
  items: AgendaItem[];
}

/**
 * Splits `total` across items in proportion to `weights`, using the largest-remainder
 * method so the parts always add up to exactly `total`.
 */
export function distribute(total: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  const sum = weights.reduce((a, b) => a + b, 0);
  const shares = weights.map((w) => (sum > 0 ? (total * w) / sum : total / weights.length));
  const parts = shares.map(Math.floor);
  let leftover = total - parts.reduce((a, b) => a + b, 0);
  const byRemainder = shares
    .map((share, i) => ({ i, remainder: share - Math.floor(share) }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  for (const { i } of byRemainder) {
    if (leftover <= 0) break;
    parts[i] += 1;
    leftover -= 1;
  }
  return parts;
}

export function summarizePlan(items: AgendaItem[], totalMinutes: number): PlanSummary {
  const assignedMinutes = items.reduce((sum, item) => sum + item.minutes, 0);
  return {
    assignedMinutes,
    overByMinutes: Math.max(0, assignedMinutes - totalMinutes),
    unassignedMinutes: Math.max(0, totalMinutes - assignedMinutes),
  };
}

/**
 * Items with explicit minutes keep them; the rest of the meeting is split evenly across
 * the items without minutes (whole minutes, at least 1 each). Never rescales silently:
 * if the plan does not fit, `overByMinutes` says by how much.
 */
export function planAgenda(parsed: ParsedItem[], totalMinutes: number): PlanResult {
  const fixedSum = parsed.reduce((sum, item) => sum + (item.minutes ?? 0), 0);
  const flexCount = parsed.filter((item) => item.minutes === undefined).length;
  const room = totalMinutes - fixedSum;

  const flexMinutes =
    flexCount === 0 ? [] : room < flexCount ? Array<number>(flexCount).fill(1) : distribute(room, Array<number>(flexCount).fill(1));

  let flexIndex = 0;
  const items: AgendaItem[] = parsed.map((item, index) => ({
    id: `item-${index + 1}`,
    title: item.title,
    minutes: item.minutes ?? flexMinutes[flexIndex++],
    ...(item.participants?.length ? { participants: item.participants } : {}),
  }));

  return { items, ...summarizePlan(items, totalMinutes) };
}
