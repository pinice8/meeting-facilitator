import { ON_SCHEDULE_MS } from "./timer";

/** mm:ss, or h:mm:ss over an hour. Negative values are shown with a leading minus. */
export function formatClock(ms: number): string {
  const sign = ms < 0 ? "-" : "";
  const totalSeconds = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${sign}${h}:${mm}:${ss}` : `${sign}${mm}:${ss}`;
}

export function formatDelta(deltaMs: number): string {
  if (Math.abs(deltaMs) <= ON_SCHEDULE_MS) return "On schedule";
  const minutes = Math.max(1, Math.round(Math.abs(deltaMs) / 60_000));
  return deltaMs > 0 ? `${minutes} min behind` : `${minutes} min ahead`;
}
