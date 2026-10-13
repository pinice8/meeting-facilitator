export interface ParsedItem {
  title: string;
  minutes?: number;
}

const BULLET = /^\s*(?:[-*•–·▪]|\d+[.)])\s+/;
const UNIT = "(?:minutes?|mins?|m)";
const MAX_MINUTES = 240;

function validMinutes(raw: string): number | undefined {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= MAX_MINUTES ? n : undefined;
}

/** Splits one agenda line into a title and optional minutes. Returns undefined for blank lines. */
function parseLine(rawLine: string): ParsedItem | undefined {
  const line = rawLine.replace(BULLET, "").trim();
  if (!line) return undefined;

  // "10 min - Title"
  const leading = line.match(new RegExp(`^(\\d+)\\s*${UNIT}\\s*[-–—:]\\s*(.+)$`, "i"));
  if (leading) {
    const minutes = validMinutes(leading[1]);
    if (minutes) return { title: leading[2].trim(), minutes };
  }

  const trailing: RegExp[] = [
    new RegExp(`\\(\\s*(\\d+)\\s*${UNIT}?\\s*\\)\\s*$`, "i"), // Title (10 min)
    new RegExp(`\\[\\s*(\\d+)\\s*${UNIT}?\\s*\\]\\s*$`, "i"), // Title [10]
    new RegExp(`(?:\\s[-–—]|\\s?:)\\s*(\\d+)\\s*${UNIT}?\\s*$`, "i"), // Title - 10 / Title: 10 min
    new RegExp(`\\s(\\d+)\\s*${UNIT}\\s*$`, "i"), //             Title 10 min
  ];
  for (const re of trailing) {
    const m = line.match(re);
    if (!m || m.index === undefined) continue;
    const minutes = validMinutes(m[1]);
    const title = line.slice(0, m.index).trim();
    if (minutes && title) return { title, minutes };
  }
  return { title: line };
}

/** Parses free text (one item per line, optional minutes) into agenda items. */
export function parseAgenda(text: string): ParsedItem[] {
  return text
    .split(/\r?\n/)
    .map(parseLine)
    .filter((item): item is ParsedItem => item !== undefined);
}
